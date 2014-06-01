


var debouncedUpdate = false;

var updateEditDoc = function (event, template) {

  console.log('debounce: ' + event);

  var form = template.find('.edit-document-form');
  var params = {};

  params[event.currentTarget.name] = event.currentTarget.value;

  EditDocuments.update(
    {
      _id: form.dataset.editDocId
    },
    {
      $set: params
    }
  );

  console.log(EditDocuments.findOne({_id: form.dataset.editDocId}));

}

editEvents = ({
  'keyup .edit-document-form .edit-document-form-input, keyup .edit-document-form .edit-document-form-textarea': function (event, template) {

    if(!debouncedUpdate) {
      debouncedUpdate = true;
      debouncedUpdateEditDoc = _.debounce(updateEditDoc, 300);
    }

    debouncedUpdateEditDoc(event, template);
    console.log('keyup: ' + event);

  },
  'submit .edit-document-form': function (event, template) {

    var form = event.currentTarget;

    event.preventDefault();

    // @@@ Create a workflow function
    EditDocuments.update({
      _id: form.dataset.editDocId
    }, {
      $set: { state: 'committed', action: 'update', userId: Meteor.userId() }
    });

    console.log('submit: ' + event);
  }
});


Template.diffParts.helpers({
  parts: function () {
    try {
      return EditDiffs.findOne({editDocId: this.editDocId})[this.nameSpace];
    } catch (err) {
      console.log(err);
    }
  }
})

UI.registerHelper('editFormAttrs', function () {
  return {
    'data-edit-doc-id': this.editDoc()._id,
    'data-id': this._id,
    'data-doc-id': this.editDoc().docId,
    'data-doc-type': this.editDoc().docType,
    'id': this.editDoc().docType + '-' + this.editDoc().docId
  }
});


