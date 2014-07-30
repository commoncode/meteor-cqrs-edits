JsDiff = Npm.require('diff');

EditDocuments.find().observeChanges({
  changed: function (id, fields) {
    //
    // We expect the editDoc to be changed frequently, either by debounced keyup or
    // post OT operations.
    //
    // With each change, we'll update the editDiff document so we can feed
    // back to the user what has changed in comparison to the original.
    var diffs = {}, // the working copy
      editDoc = EditDocuments.findOne({
        _id: id
      }), // should be 'this'?
      editDiff = EditDiffs.findOne({
        editDocId: editDoc._id
      }),
      data, httpMethod, path, access_token;

    if (editDiff !== undefined) {
      // if we have an existing editDiff, that becomes the working copy
      diffs = editDiff;
      // remove the _id to avoid including it in the $set operation
      // saving a reference to it first, just in case its needed.
      editDiffId = diffs._id;
      delete diffs._id;
    } else {
      // Assign the editDoc _id because we won't have that yet.
      // diffs['editDocId'] = editDoc._id;
    }

    _.each(_.keys(fields), function (element, index, list) {
      var original = editDoc.origObj[element];

      if (typeof original === 'object') {
        original = String(original);
      }

      if (String(editDoc.origObj[element]).split(' ').length > 3) {
        diffs[element] = JsDiff.diffWords(original, fields[element]);
      } else {
        diffs[element] = JsDiff.diffChars(original, fields[element]);
      }
    });

    EditDiffs.upsert({
      editDocId: editDoc._id
    }, {
      $set: diffs
    });

    //
    // Handling CQRS Updates
    //

    //
    // From here we handle communication of writes to the API source
    // or DDP client.
    //
    // There are 4 methods.
    //
    // 1) API Catch All Endpoint
    //   here we route to API endpoints according to the data we've
    //    stored on the editDocument.  For example, we might have:
    //
    //      Document.url or Document.apiURL
    //
    //    which tells the end point that we can post changes too.
    //    b) when we update via REST we get a response, ei
    //
    // make api call POST
    // 200
    // get results back immediately.

    if (editDoc.state === 'committed') {
      if (editDoc.hasChanges()) {
        // We're doing this computation twice...
        // first in hasChanges, then in dataChanges,
        // what's the best way to lightly check I wonder?
        // TODO @@@ optimize
        data = editDoc.dataChanges();

        // We need this for the polymorphic stuff.
        data.type = editDoc.docType;
        data.pk = editDoc.docId;

        // console.log('Patching data');
        // console.log(data);
        // console.log(path);
        // console.log(auth);

        // categories = Categories.find({}).fetch()
        // data['category'] = categories[Math.floor(Math.random()* categories.length)]
        // console.log('rand category');
        // console.log(data['category']);

        httpMethod = editDoc.action === 'delete' ? 'DELETE' : 'PATCH';
        path = apiURL('cqrs/' + editDoc.docCollection + '/' + editDoc.docId + '/');
        access_token = Meteor.users.findOne({
          _id: editDoc.userId
        }).services.m10.access_token;

        try {
          // Send HTTP call to Django
          HTTP.call(httpMethod, path, {
            headers: {
              'Authorization': 'Bearer ' + access_token
            },
            params: data
          }, function (error, result) {
            EditDocuments.update({
              _id: editDoc._id
            }, {
              $set: {
                'response': result,
                'state': 'ready'
              }
            });

            editDoc.resetEdits();
          });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        // console.log('No data to patch');
      }
    }

    /*
    product: {
      docType: 'product',
      docId: '1',
      url:
      variants: [
        {
          docType: 'variant',
          docId: '2',
          url:
        }
      ]
    }

    2) Using MongoDB as a queue.
    3) Using DDP to listen
    4) RPC
       Here we could use a server side method, perhaps provided by
       Zero RPC

    So for methods 2 & 3 we're relying on the CQRS server to listen to the changes
    that we've made, via DDP or the Mongo Oplog.  We don't have anymore work to do
    other than to listen for the changes that the CQRS server is making to the Edit
    Document; so we know when to proceed.

    Method's 1 & 4 involved taking matters into our own hands, by deterministicly
    making a call to the CQRS server to seek a response.  This process might be
    valueable when we're seeking a faster, syncronous response to our actions, in
    a situation that needs more realtime; immediately consistent data.
    if keys contain 'action' or 'status' then we might need to do something here.

    Handling Errors
    In each method of communication we can statefully store the success
    or error response on the editDocument itself, perhaps in an array of
    operations:
    editDoc : {
      ops: [
        {
          sentAt: '...',
          errors: {
            name: 'Should not be blank',
            username: 'Should have'
          }
        }
      ]
    }
    the latest operation is the one shown, with any errors
    or messages superseeding the rest.
    */
  }
});

Meteor.methods({
  getOrCreateEditDoc: function (obj) {
    // Ideally we'll only ever have one editDoc per readDoc, however
    // the possibility of multiples thinly exist.
    //
    // Here we find the first editDoc to match our parameters, which
    // should always be the same according to database order

    var editDoc = EditDocuments.findOne({
        docType: obj.type,
        docId: obj._id
      }),
      editObj, i;

    if (editDoc === undefined) {
      editObj = _.omit(_.pick(obj, _.keys(obj)), ['_id']);

      // used to create diffs and compare the original field keys
      // this would need to be reset once a Document is regenerated
      // from the Command side.
      // Make sure we don't copy any attrs that are not data related
      editObj.origObj = _.omit(_.pick(obj, _.keys(obj)), [
        '_id',
        'type',
        'docCollection',
        'docId',
        'docType'
      ]);

      editObj.docType = obj.type;
      editObj.docCollection = obj.docCollection;
      editObj.docId = obj._id;
      editObj.state = 'ready';
      editObj.action = 'read';

      editDoc = EditDocuments.insert(editObj);
    }

    // Are there any strays?  Get the list.
    editDocs = EditDocuments.find({
      docType: obj.type,
      docId: obj._id
    });

    if (editDoc && editDocs.count() > 1) {
      // Somehow we have duplicates.  Remove the others.
      // Hopefully we never end up here.
      dupDocs = EditDocuments.find({
        // _id: {$not: editDoc._id}, // this isn't valid?
        docId: editDoc.docId,
        docType: editDoc.docType
      }).fetch();

      // Ideally we'd use $not to do something like:
      // EditDocuments.remove({_id: {$not: editDoc._id}, ... })
      // However that seems to be invalid here.  Must be a Meteor quirk
      //
      // Instead, we loop through an remove duplicates
      // individually, passing in the ID.
      for (i = dupDocs.length - 1; i >= 0; i--) {
        if (editDoc._id !== dupDocs[i]._id) {
          EditDocuments.remove({
            _id: dupDocs[i]._id
          });
        }
      }
    }

    return editDoc;
  }
});
