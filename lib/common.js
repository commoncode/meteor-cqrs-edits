
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
  }
});


editHelpers = { // relies on David Burles' Collection Helpers.
  editDoc: function() {
    // Return the EditDocument

    var editDoc = EditDocuments.findOne({
      docId: this._id,
      docType: this.type
    });

    if(editDoc!==undefined) {
      return editDoc
    }

    // Avoid this call to the server if we can.
    // We're making the call atm; because it seems more reliable to
    // do this on the server.  Doing it clientside seemed to result in
    // multiple eroneous edit documents being created
    Meteor.call('getOrCreateEditDoc', this, function (error, result) {});

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
