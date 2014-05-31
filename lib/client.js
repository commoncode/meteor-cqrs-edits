




editEvents = ({
  'keyup .edit-document-form .edit-document-form-input, keyup .edit-document-form .edit-document-form-textarea': function (event, template) {


    // var pos = doGetCaretPosition(event.currentTarget);
    var form = template.find('.edit-document-form');
    var params = {};

    params[event.currentTarget.name] = event.currentTarget.value;

    EditDocuments.update(
      {
        _id: form.dataset.id
      },
      {
        $set: params
      }
    );

    // debugger;

    console.log('keyup: ' + event);
    console.log(EditDocuments.findOne({_id: form.dataset.id}));
    // console.log('keyup pos: ' + pos);
    // console.log(params);

  },
  'submit .edit-document-form': function (event, template) {

    var form = event.currentTarget;

    event.preventDefault();

    // @@@ Create a workflow function
    EditDocuments.update({
      _id: form.dataset.id
    }, {
      $set: { state: 'committed', action: 'update' }
    });

    console.log('submit: ' + event);
  }
})
