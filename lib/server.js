
Meteor.startup(function() {
  // Trash
  editDocs = EditDocuments.find();
  _.each(editDocs, function(editDoc) {
    // For every editDoc that is orphaned, clean up.
    console.log(editDoc);
    // @@@ TODO clean up orphans.
  })
});


editsRegister = [
  {
    'collection': 'quote',
    'priority': 'high',
    'method': 'rest'
  },
  {
    'collection': 'offer'
  }
]


editDocsCursor = EditDocuments.find({});

editDocsCursor.observeChanges({
  changed: function (id, fields) {
    //
    // We expect the editDoc to be changed frequently, either by keyup or
    // post OT operations.
    //
    // With each change, we'll update the editDiff document so we can feed
    // back to the user what has changed in comparison to the original.

    var debug = true;

    //
    // Handling Diffs.
    //

    if(debug){
      console.log(id);
      console.log(fields);
    }

    var diffs = {};
    var diffsByWords = {};
    var diffsByChars = {};
    var editDoc = EditDocuments.findOne({_id: id});
    var editDiff = EditDiffs.findOne({editDocId: editDoc._id});

    if(editDiff!==undefined){
      diffs = editDiff.diffs;
    };

    _.each(_.keys(fields), function (element, index, list) {

      var diffWords = JsDiff.diffWords(editDoc.origObj[element], fields[element])
      var diffChars = JsDiff.diffChars(editDoc.origObj[element], fields[element])

      if(String(editDoc.origObj[element]).length > 25 ) {
        // The default diff is different, depending on the length of the text.
        diff = diffWords;
      } else {
        diff = diffChars;
      }

      diffs[element] = diff;
      diffsByWords[element] = diffWords
      diffsByChars[element] = diffChars

      if(debug){
        console.log('element: ' + element);
        console.log('index: ' + index);
        console.log('list: ' + list);
        console.log('editDoc.origObj[element]: ' + editDoc.origObj[element]);
        console.log(diff);
      }

    });

    EditDiffs.upsert(
      {
        editDocId: editDoc._id
      },
      {
        $set: {
          diffs: diffs,
          diffsByChars: diffsByChars,
          diffsByWords: diffsByWords
        }
      }
    );

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

    // 2) Using MongoDB as a queue.
    //
    //
    // 3) Using DDP to listen
    //
    //
    // 4) RPC
    //    Here we could use a server side method, perhaps provided by
    //    Zero RPC
    //
    // So for methods 2 & 3 we're relying on the CQRS server to listen to the changes
    // that we've made, via DDP or the Mongo Oplog.  We don't have anymore work to do
    // other than to listen for the changes that the CQRS server is making to the Edit
    // Document; so we know when to proceed.
    //
    // Method's 1 & 4 involved taking matters into our own hands, by deterministicly
    // making a call to the CQRS server to seek a response.  This process might be
    // valueable when we're seeking a faster, syncronous response to our actions, in
    // a situation that needs more realtime; immediately consistent data.

    // if keys contain 'action' or 'status' then we might need to do something here.




    //
    // Handling Errors
    //

    //
    // In each method of communication we can statefully store the success
    // or error response on the editDocument itself, perhaps in an array of
    // operations:

    // editDoc : {
    //   ops: [
    //     {
    //       sentAt: '...',
    //       errors: {
    //         name: 'Should not be blank',
    //         username: 'Should have'
    //       }
    //     }
    //   ]
    // }

    // the latest operation is the one shown, with any errors
    // or messages superseeding the rest.

  }
})


Meteor.methods({
  getOrCreateEditDoc: function (obj) {
    //
    // Ideally we'll only ever have one editDoc per readDoc, however
    // the possibility of multiples thinly exist.
    //
    // Here we find the first editDoc to match our parameters, which
    // should always be the same according to database order

    var editDoc = EditDocuments.findOne({
      docType: obj.type,
      docId: obj._id
    });

    if(editDoc===undefined){

      var editObj = _.omit(_.pick(obj, _.keys(obj)), ['_id']);

      // used to create diffs and compare the original field keys
      // this would need to be reset once a Document is regenerated
      // from the Command side.
      editObj.origObj = _.omit(_.pick(obj, _.keys(obj)), ['_id', 'type']);
      // start with an empty object for holding the diff parts
      editObj.diffs = {};

      editObj.docType = obj.type;
      editObj.docId = obj._id;
      editObj.state = 'ready';
      editObj.action = 'read';

      var editDoc = EditDocuments.insert(
        editObj
      );

    };

    // Are there any strays?  Get the list.
    var editDocs = EditDocuments.find({
      docType: obj.type,
      docId: obj._id
    });

    if(editDoc && editDocs.count() > 1) {
      // Somehow we have duplicates.  Remove the others.
      // Hopefully we never end up here.
      dupDocs = EditDocuments.find({
        // _id: {$not: editDoc._id}, // this isn't valid?
        docId: editDoc.docId,
        docType: editDoc.docType
      }).fetch()

      // Ideally we'd use $not to do something like:
      // EditDocuments.remove({_id: {$not: editDoc._id}, ... })
      // However that seems to be invalid here.  Must be a Meteor quirk
      //
      // Instead, we loop through an remove duplicates
      // individually, passing in the ID.
      for (var i = dupDocs.length - 1; i >= 0; i--) {
        if(editDoc._id !== dupDocs[i]._id){
          EditDocuments.remove({_id: dupDocs[i]._id});
        }
      };
    };

    return editDoc;
  }
})
