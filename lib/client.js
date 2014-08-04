var updateEditDoc, debouncedUpdateEditDoc, changeEvent, keyupEvent, selectHelpers;

moment.fn.fromNowOrNow = function (a) {
  if (Math.abs(moment().diff(this)) < 6000) {
    return 'just now';
  }

  return this.fromNow(a);
};

updateEditDoc = function (event, template) {
  var $form = template.$(event.currentTarget).parents('.edit-document-form'),
    name = event.currentTarget.name,
    value = event.currentTarget.value,
    params = {};

  switch (event.currentTarget.type) {
  case 'checkbox':
    // Must pass empty string in order to get False in Python
    value = event.currentTarget.checked ? true : '';
    break;

  case 'select-multiple':
    value = _.map(template.$(event.currentTarget).val(), function (id) {
      return parseInt(id, 10);
    });

    // In case we send complete objects, they must be "JSON-ized" otherway
    // we get [ object Object ] in M10
    /*
    value = JSON.stringify(
      eval(this.selectFrom).find({
        _id: {
          $in: value
        }
      }).fetch()
    );
    */
    break;

  case 'select-one':
    value = parseInt(value, 10);
    break;

  default:
    console.log(event.currentTarget.type);
  }

  params[name] = value;

  EditDocuments.update({
    _id: $form.data('editDocId')
  }, {
    $set: params
  });

  console.log(EditDocuments.findOne({
    _id: $form.data('editDocId')
  }));
};

// Template Events
changeEvent = {
  'change': updateEditDoc
};

keyupEvent = {
  'keyup': function (event, template) {
    if (debouncedUpdateEditDoc === undefined) {
      // Once we have an instantiated singleton of the
      // debounced function we don't need to create it again.
      // We create the function here so we have access to underscore '_'
      // However, that might be available if we put it in package.js. TODO @@@
      debouncedUpdateEditDoc = _.debounce(updateEditDoc, 300);
    }

    debouncedUpdateEditDoc(event, template);
  }
};

// Template Helpers
selectHelpers = {
  selectDocuments: function () {
    var _collection = eval(this.selectFrom),
      value = this.value,
      docs = [],
      options = {};

    // apply sorting to cursor if a sortField has been specified
    if (this.sortField !== undefined) {
      options.sort = {};
      options.sort[this.sortField] = this.sortDirection !== undefined ? this.sortDirection : 1;
    }

    // here we decorate each document with the value to do a later comparison
    // as it seems impossible to pass in arguments from outside to inside an #each
    // loop structure.  This took to long to figure out :\
    _collection.find({}, options).forEach(function (doc) {
      doc.value = value;
      docs.push(doc);
    });

    return docs;
  },
  selectedAttr: function () {
    if (_.isArray(this.value)) {
      return _.indexOf(this.value, this._id) !== -1 ? 'selected' : '';
    } else {
      return this.value === this._id ? 'selected' : '';
    }
  },
  isSelected: function () {
    if (_.isArray(this.value)) {
      return _.indexOf(this.value, this._id) !== -1;
    } else {
      return this.value === this._id;
    }
  }
};

// Checkbox
Template.editDocFormCheckbox.events(changeEvent);
Template.editDocFormCheckbox.helpers({
  checked: function () {
    return this.value ? 'checked' : '';
  }
});

// Datetime
Template.editDocFormDatetime.events(changeEvent);
Template.editDocFormDatetime.helpers({
  datetime: function () {
    var value,
      input = this.value,
      padZero = function (x) {
        return x > 10 ? x : '0' + x;
      };

    if (!input) {
      return;
    }

    if (typeof input === 'string') {
      input = new Date(input);
    }

    value = '';
    value += input.getFullYear() + '-';
    value += padZero(input.getMonth() + 1) + '-';
    value += padZero(input.getDate()) + 'T';
    value += padZero(input.getHours()) + ':';
    value += padZero(input.getMinutes());

    return value;
  }
});

// Password
Template.editDocFormPassword.events(keyupEvent);

// Radio
Template.editDocFormRadio.events(changeEvent);

// Text
Template.editDocFormText.events(keyupEvent);

// Textarea
Template.editDocFormTextarea.events(keyupEvent);

// Select
Template.editDocFormSelect.events(changeEvent);
Template.editDocFormSelect.helpers(selectHelpers);

// Select Multiple
Template.editDocFormSelectMultiple.events(changeEvent);
Template.editDocFormSelectMultiple.helpers(selectHelpers);

// Time Since
Template.editDocTimeSince.rendered = function () {
  Meteor.setInterval(function () {
    var $self = this.$('.edit-document-time-since');

    $self.text(moment(parseInt($self.attr('data-timestamp'), 10)).fromNowOrNow());
  }, 2000);
};

// Diff Parts
Template.diffParts.helpers({
  parts: function () {
    // We catch and pass on the errors here as they're a little undetermined.
    // We're using this helper function to explicity return the diff parts;
    // we had trouble implicitly passing these down through the template context.
    // Spacebars feels wonky here...
    try {
      return EditDiffs.findOne({
        editDocId: this.editDocId
      })[this.nameSpace];
    } catch (ignore) {
      // We don't have a diff yet for the given nameSpace... so let's relax and do nothing.
      // console.log(err);
    }
  }
});

// CQRS Events
CQRS.editEvents = {
  'submit .edit-document-form': function (event, template) {
    // Catch the form submit event and change the editDoc status to
    // committed.  This will be observed by a cursor observer, resulting in
    // an API call to the server to negotiate a Write.
    var form = event.currentTarget,
      // update is the default action.  We'll listen for modifiers and change
      // accordingly
      action = 'update';

    // are we deleting?
    // @@@ seems like there could be better ways to do this; we'll need
    // to account for duplicating objects too... or operations like "save as new"
    if (template.$('[name=delete]').is(':checked')) {
      action = 'delete';
    }

    // @@@ Create a workflow function
    // The document is flagged 'committed' and 'update', and with the user
    // responsible for making the action.

    // @@@ TODO if the document is already 'committed' don't attempt again.
    EditDocuments.update({
      _id: form.dataset.editDocId
    }, {
      $set: {
        state: 'committed',
        action: action,
        userId: Meteor.userId()
      }
    });

    event.preventDefault();
  },
  'reset .edit-document-form': function (event) {
    var docId = event.currentTarget.dataset.editDocId,
      editDoc = EditDocuments.findOne({
        _id: docId
      });

    if (editDoc.state === 'committed') {
      // If the editDoc is in a 'committed' state, we may have time to
      // reset; perhaps the server is down and we want to keep using the form.
      EditDocuments.update({
        _id: docId
      }, {
        $set: {
          state: 'ready',
          action: 'update',
          userId: Meteor.userId()
        }
      });
    }

    event.preventDefault();
  }
};

// UI Helpers
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
    };
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
    //console.log(error);
    return;
  }
});
