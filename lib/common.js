var permissions = {
  insert: function (userId, doc) {
    return true;
  },
  update: function (userId, doc, fields, modifier) {
    return true;
  },
  remove: function (userId, doc) {
    return true;
  }
};

CQRS = {};

EditDocuments = new Meteor.Collection('edit_documents');
EditDiffs = new Meteor.Collection('edit_diffs');

EditDocuments.allow(permissions);
EditDiffs.allow(permissions);

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
  dataChanges: function () {
    // Calculate if we have any changes of interest.
    var data = {},
      // These are the keys we'll be interested in updating
      // console.log(editDoc);
      updateKeys = _.keys(this.origObj),
      // console.log('updateKeys: ' + updateKeys);
      // Fetch this again so we have an updated copy.
      editDiff = EditDiffs.findOne({
        editDocId: this._id
      }),
      i;

    if (editDiff) {
      for (i = updateKeys.length - 1; i >= 0; i--) {
        if (editDiff[updateKeys[i]] !== undefined) {
          // We have something to update, push it into our data
          // console.log('... adding: ' + updateKeys[i] + ' :: ' + editDoc[updateKeys[i]]);
          data[updateKeys[i]] = this[updateKeys[i]];
        }
      };
    };
    return data;
  },
  hasChanges: function () {
    return _.keys(this.dataChanges()).length > 0
  },
  fromNowOrNow: function () {
    try {
      return moment(this.updatedAt).fromNowOrNow();
    } catch (err) {
      console.log(err);
      return '—'
    }
  },
});

// CQRS Helpers
CQRS.editHelpers = {
  editDoc: function () {
    var editDoc = EditDocuments.findOne({
      docId: this._id,
      docType: this.type
    });

    if (editDoc) {
      return editDoc;
    }

    // We assign this as a simple data type, ready for passing to the meteor
    // method.  It seems we lose the data types via passing them through.
    this.docCollection = this.Collection._collection.name;
    console.log(this.docCollection)

    Meteor.call('getOrCreateEditDoc', this, function (error, result) {});

    return EditDocuments.findOne({
      docId: this._id,
      docType: this.type
    });
  },
  upsertEditDoc: function (options) {
    // Pass in changes to the Edit Document
    console.log('upsertEditDoc');

    if (this.editDocIsReady()) {
      console.log('edit document is ready, upserting...');
      EditDocuments.upsert({
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
    try {
      return this.editDoc().state === 'ready';
    } catch (error) {
      return false;
    }
  }
}
