$.fn.selectRange = (start, end) ->
  end = end ? end : start

  return @.each ->
    if @.setSelectionRange
      @.focus()
      @.setSelectionRange(start, end)
    else if @.createTextRange
      range = @.createTextRange()
      range.collapse true
      range.moveEnd('character', end)
      range.moveStart('character', start)
      range.select()

moment.fn.fromNowOrNow = (a) ->
  if Math.abs(moment().diff(@)) < 6000
    return 'just now'

  return @.fromNow a

initOTDoc = ->
  template = @
  shareName = template.$('input').attr 'id'
  channel = "#{location.protocol}//#{location.host}/channel"

  sharejs.open(shareName, 'text', channel, (error, doc) ->
    if error
      return console.log error

    template.shareDoc = doc
  )

updateEditDoc = (event, template) ->
  $form = template.$(event.currentTarget).parents '.edit-document-form'
  name = event.currentTarget.name
  value = event.currentTarget.value
  params = {}
  $input = null
  applyOT = (oldValue) ->
    end = 0
    start = 0

    if oldValue is value
      return

    while oldValue.charAt(start) is value.charAt(start)
      start += 1

    while oldValue.charAt(oldValue.length - 1 - end) is
    value.charAt(value.length - 1 - end) and
    end + start < oldValue.length and
    end + start < value.length
      end += 1

    if oldValue.length isnt start + end
      template.shareDoc.del(start, oldValue.length - start - end)

    if value.length isnt start + end
      template.shareDoc.insert(start, value.slice(start, value.length - end))

    return

  switch event.currentTarget.type
    when 'checkbox'
      # Must pass empty string in order to get False in Python
      value = event.currentTarget.checked ? true : ''

    when 'select-multiple'
      value = _.map(template.$(event.currentTarget).val(), (id) ->
        return parseInt(id, 10)
      )

      # In case we send complete objects, they must be "JSON-ized" otherway
      # we get [ object Object ] in M10
      ###
      value = JSON.stringify(
        eval(@.selectFrom).find({
          _id: {
            $in: value
          }
        }).fetch()
      );
      ###

    when 'select-one'
      value = parseInt(value, 10)

    when 'text', 'textarea'
      value = value.replace(/\r\n/g, '\n')
      oldValue = template.shareDoc.getText()

      if value is oldValue
        return

      applyOT(oldValue)
      value = template.shareDoc.getText()

      Session.set('cursorPosition',
        start: event.currentTarget.selectionStart
        end: event.currentTarget.selectionEnd
      )

  params[name] = value

  EditDocuments.update(
    _id: $form.data 'editDocId'
  ,
    $set: params
  )

debouncedUpdateEditDoc = _.debounce(updateEditDoc, 750)

# Template Events
changeEvent =
  'change': updateEditDoc

keyupEvent =
  'blur': (event, template) ->
    Session.set('cursorPosition', null)

  'keyup, keypress': (event, template) ->
    key = event.keyCode or event.charCode

    if event.type is 'keyup' and key not in [8, 46]
      return false

    debouncedUpdateEditDoc(event, template)

# Checkbox
Template.editDocFormCheckbox.events changeEvent
Template.editDocFormCheckbox.helpers
  checked: ->
    return @.value ? 'checked' : ''

# Datetime
Template.editDocFormDatetime.events changeEvent
Template.editDocFormDatetime.helpers
  datetime: ->
    input = @.value
    padZero = (x) ->
      return x > 10 ? x : '0' + x

    if not input
      return

    if typeof input is 'string'
      input = new Date input

    value = ''
    value += input.getFullYear() + '-'
    value += padZero(input.getMonth() + 1) + '-'
    value += padZero(input.getDate()) + 'T'
    value += padZero(input.getHours()) + ':'
    value += padZero(input.getMinutes())

    return value;

# Password
Template.editDocFormPassword.events keyupEvent

# Radio
Template.editDocFormRadio.events changeEvent

# Text
Template.editDocFormText.events keyupEvent
Template.editDocFormText.rendered = initOTDoc

# Textarea
Template.editDocFormTextarea.events keyupEvent
Template.editDocFormTextarea.rendered = initOTDoc

# Select
Template.editDocFormSelect.events changeEvent
Template.editDocFormSelect.helpers
  selectDocuments: ->
    _collection = eval @.selectFrom
    value = @.value
    docs = []
    options = {}

    # apply sorting to cursor if a sortField has been specified
    if @.sortField isnt undefined
      options.sort = {}
      options.sort[@.sortField] = @.sortDirection is undefined ? 1 : @.sortDirection

    # here we decorate each document with the value to do a later comparison
    # as it seems impossible to pass in arguments from outside to inside an #each
    # loop structure.  @ took to long to figure out :\
    _collection.find({}, options).forEach (doc) ->
      doc.value = value
      docs.push doc

    return docs

Template.editDocFormSelectOption.helpers
  selectedAttr: ->
    if _.isArray @.value
      return _.indexOf(@.value, @._id) isnt -1 ? 'selected' : ''
    else
      return @.value is @._id ? 'selected' : ''

  isSelected: ->
    if _.isArray @.value
      return _.indexOf(@.value, @._id) isnt -1
    else
      return @.value is @._id

# Time Since
Template.editDocTimeSince.rendered = ->
  Meteor.setInterval(->
    $self = @.$('.edit-document-time-since')

    $self.text(moment(parseInt($self.attr('data-timestamp'), 10)).fromNowOrNow())
  , 2000)

# Diff Parts
Template.diffParts.helpers
  parts: ->
    # We catch and pass on the errors here as they're a little undetermined.
    # We're using @ helper function to explicity return the diff parts;
    # we had trouble implicitly passing these down through the template context.
    # Spacebars feels wonky here...
    try
      return EditDiffs.findOne(
        editDocId: @.editDocId
      )[@.nameSpace]
    catch ignore
      # We don't have a diff yet for the given nameSpace... so let's relax and do nothing.
      # console.log(err);

# CQRS Events
CQRS.editEvents =
  'submit .edit-document-form': (event, template) ->
    # Catch the form submit event and change the editDoc status to
    # committed.  @ will be observed by a cursor observer, resulting in
    # an API call to the server to negotiate a Write.
    form = event.currentTarget

    # update is the default action.  We'll listen for modifiers and change
    # accordingly
    action = template.$('[name=delete]').is(':checked') ? 'delete' : 'update'

    # @@@ Create a workflow function
    # The document is flagged 'committed' and 'update', and with the user
    # responsible for making the action.

    # @@@ TODO if the document is already 'committed' don't attempt again.
    EditDocuments.update(
      _id: form.dataset.editDocId
    ,
      $set:
        state: 'committed'
        action: action
        userId: Meteor.userId()
    )

    event.preventDefault()

  'reset .edit-document-form': (event) ->
    docId = event.currentTarget.dataset.editDocId
    editDoc = EditDocuments.findOne _id: docId

    if editDoc.state is 'committed'
      # If the editDoc is in a 'committed' state, we may have time to
      # reset; perhaps the server is down and we want to keep using the form.
      EditDocuments.update(
        _id: docId
      ,
        $set:
          state: 'ready'
          action: 'update'
          userId: Meteor.userId()
      )

    event.preventDefault()

# UI Helpers
UI.registerHelper('editFormAttrs', ->
  try
    doc = @.editDoc()

    attributes =
      # conveniently & cleanly decorate our editDoc forms
      # with all the necessary attrs needed to identify the form
      # appropriately
      'data-edit-doc-id': doc._id
      'data-id': @._id
      'data-doc-id': doc.docId
      'data-doc-type': doc.docType
      'id': doc.docType + '-' + doc.docId

    Deps.autorun ->
      EditDocuments.find(
        _id: doc._id
      ).observeChanges
          changed: (id, fields) ->
            cursor = Session.get 'cursorPosition'

            for own key, value of fields
              $field = $("form##{attributes.id} [name=#{key}]")
              $field.val(value)

              if cursor
                $field.selectRange(cursor.start, cursor.end)

    return attributes
  catch error
    # We shouldn't be getting an erorr here, but we are.  Seems like
    # racey stuff happening, i.e. the editDoc call hasn't yet had the chance
    # to return the attributes beyond the parenthesis:
    #
    #     editDoc().fooooo
    #
    # So we just catch @ and log it.  Meteor seems to sort things out and
    # runs @ again successfully not long after; or another Deps computation
    # is fired.
    #console.log(error);
    return;
)
