
EditDocuments = new Meteor.Collection('edit_documents');
EditDiffs = new Meteor.Collection('edit_diffs');

EditDocuments.allow({
  insert: function (userId, doc) {
    return true;
  },
  update: function (userId, doc, fields, modifier) {
    return true;
  },
  remove: function (userId, doc) {
    return true;
  }
});


EditDiffs.allow({
  insert: function (userId, doc) {
    return true;
  },
  update: function (userId, doc, fields, modifier) {
    return true;
  },
  remove: function (userId, doc) {
    return true;
  }
});


// @@@ these are currently here for reference.
// will work on a more formal usage.
editStates = [
  'ready',
  'committed',
  'error',
  'acknowledged',
  'saved',
  'reported'
]
editActions = [
  'create',
  'read',
  'update',
  'delete',
  'duplicate'
]


EditDocuments.helpers({
  editDiffs: function () {
    return EditDiffs.findOne({
      editDocId: this._id
    })
  },
  resetEdits: function () {
    EditDiffs.remove({
      editDocId: this._id
    })
  },
  fromNowOrNow: function() {
    try {
      return moment(this.updatedAt).fromNowOrNow();
    } catch (err) {
      console.log(err);
      return '—'
    }
  },
});


editHelpers = function(collection) {
  self = this;
  return {
    editDoc: function() {
       var editDoc = EditDocuments.findOne({
         docId: self._id,
         docType: self.type
       });

       // debugger;


       Meteor.call('getOrCreateEditDoc', collection, function (error, result) {});

      // Meteor.call('getOrCreateEditDoc', this, function (error, result) {});

      return EditDocuments.findOne({
        docId: this._id,
        docType: this.type
      });

    },
    upsertEditDoc: function(options) {
      // Pass in changes to the Edit Document
      console.log('upsertEditDoc');
      if(this.editDocIsReady()){
        console.log('edit document is ready, upserting...');
        EditDocuments.upsert(
          {
            docId: this._id,
            docType: this.type
          },
          options
        )
      } else {
        console.log('edit document is not ready');
        // raise some kind of message / error
      }
    },
    commitEditDoc: function () {
      // Set the Edit Document status to 'committed' and
      // allow no more changes until the status is changed
      // back to 'ready'
      EditDocument.update({
        docId: this._id,
        docType: this.type,
        state: 'committed'
      });
    },
    editDocIsReady: function () {
      // Return true if the Edit Document is ready for
      // collaboritive edits

      return this.editDoc().state === 'ready';
  }
  }
}
