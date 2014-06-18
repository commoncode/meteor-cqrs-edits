

var updateEditDoc = function (event, template) {

  // Update the editDoc with an event originating from
  // a form bound with the editDoc data.

  console.log('debounce: ' + event);

  var form = template.find('.edit-document-form');
  var params = {};

  // Some sanity checking to coerce data types
  if(event.currentTarget.dataset.dataType==='integer') {
    params[event.currentTarget.name] = parseInt(event.currentTarget.value);
  } else if(event.currentTarget.dataset.dataType==='json') {
    // debugger;

  } else {
    params[event.currentTarget.name] = event.currentTarget.value;
  }

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

// Set this to false as a once off trip wire.
var debouncedUpdate = false;

editEvents = ({
  'keyup .edit-document-form .edit-document-form-input, keyup .edit-document-form .edit-document-form-textarea': function (event, template) {

    if(!debouncedUpdate) {
      // Once we have an instantiated singleton of the
      // debounced function we don't need to create it again.
      // We create the function here so we have access to underscore '_'
      // However, that might be available if we put it in package.js. TODO @@@
      debouncedUpdate = true;
      debouncedUpdateEditDoc = _.debounce(updateEditDoc, 300);
    }

    debouncedUpdateEditDoc(event, template);
    console.log('keyup: ' + event);

  },
  'change .edit-document-form .edit-document-form-select': function (event, template) {
    updateEditDoc(event, template);
    console.log('change: ' + event);
  },
  'submit .edit-document-form': function (event, template) {
    // Catch the form submit event and change the editDoc status to
    // committed.  This will be observed by a cursor observer, resulting in
    // an API call to the server to negotiate a Write.
    var form = event.currentTarget;

    // update is the default action.  We'll listen for modifiers and change
    // accordingly
    var action = 'update';

    // are we deleting?
    // @@@ seems like there could be better ways to do this; we'll need
    // to account for duplicating objects too... or operations like "save as new"
    if(template.find('[name=delete]').value) {
      action = 'delete'
    }

    // @@@ Create a workflow function
    // The document is flagged 'committed' and 'update', and with the user
    // responsible for making the action.

    // @@@ TODO if the document is already 'committed' don't attempt again.
    EditDocuments.update({
      _id: form.dataset.editDocId
    }, {
      $set: { state: 'committed', action: action, userId: Meteor.userId() }
    });

    console.log('submit: ' + event);

    event.preventDefault();
  },
  'reset .edit-document-form': function (event, template) {
    var form = event.currentTarget;

    var editDoc = EditDocuments.findOne({
      _id: form.dataset.editDocId
    });

    if(editDoc.state==='committed') {
      // If the editDoc is in a 'committed' state, we may have time to
      // reset; perhaps the server is down and we want to keep using the form.
      EditDocuments.update({
        _id: form.dataset.editDocId
      }, {
        $set: { state: 'ready', action: 'update', userId: Meteor.userId() }
      });
    }

    event.preventDefault();
  }
});


Template.editDocFormSelect.helpers({
  selectDocuments: function () {
    var _collection = eval(this.selectFrom);
    var selectValue = this.selectValue;
    // here we decorate each document with the selectValue to do a later comparison
    // as it seems impossible to pass in arguments from outside to inside an #each
    // loop structure.  This took to long to figure out :\
    var docs = [];
    var cursor;

    // debugger;

    // apply sorting to cursor if a sortField has been specified
    if (this.sortField !== undefined) {
      var sortOptions = {};
      sortOptions[this.sortField] = this.sortDirection !== undefined ? this.sortDirection : 1;
      cursor = _collection.find({}, { sort: sortOptions });
    } else {
      cursor = _collection.find();
    };

    _.each(cursor.fetch(), function (value, key, list) {
      value.selectValue = selectValue;
      docs.push(value);
    });
    return docs;
  },
  selectedAttr: function () {
    return this.selectValue === this._id ? 'selected' : '';
  },
  isSelected: function () {
    return this.selectValue === this._id;
  }
});


Template.diffParts.helpers({
  parts: function () {
    // We catch and pass on the errors here as they're a little undetermined.
    // We're using this helper function to explicity return the diff parts;
    // we had trouble implicitly passing these down through the template context.
    // Spacebars feels wonky here...
    try {
      return EditDiffs.findOne({editDocId: this.editDocId})[this.nameSpace];
    } catch (err) {
      // We don't have a diff yet for the given nameSpace... so let's relax and do nothing.
      // console.log(err);
    }
  }
});


UI.registerHelper('editFormAttrs', function () {
  try {
    return {
      // conveniently & cleanly decorate our editDoc forms
      // with all the necessary attrs needed to identify the form
      // appropriately
      'data-edit-doc-id': this.editDoc()._id,
      'data-id': this._id,
      'data-doc-id': this.editDoc().docId,
      'data-doc-type': this.editDoc().docType,
      'id': this.editDoc().docType + '-' + this.editDoc().docId
    }
  } catch (error) {
    // We shouldn't be getting an erorr here, but we are.  Seems like
    // racey stuff happening, i.e. the editDoc call hasn't yet had the chance
    // to return the attributes beyond the parenthesis:
    //
    //     editDoc().fooooo
    //
    // So we just catch this and log it.  Meteor seems to sort things out and
    // runs this again successfully not long after; or another Deps computation
    // is fired.
    console.log(error);
  }
});

// @@@ Put this somewhere generic?
Meteor.startup(function() {
  moment.fn.fromNowOrNow = function (a) {
    if (Math.abs(moment().diff(this)) < 6000) {
      return 'just now';
    }
    return this.fromNow(a);
  }

  updateTimeSince = function() {
    $('.edit-document-time-since').each(function() {
      var timestamp = $(this).attr('data-timestamp');
      var fromNow = moment(parseInt(timestamp)).fromNowOrNow();
      $(this).text(fromNow);
    });
  };

  Meteor.setInterval(updateTimeSince, 2000);

});


