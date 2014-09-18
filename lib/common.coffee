CQRS = {}

EditDocuments = new Meteor.Collection 'edit_documents'
EditDiffs = new Meteor.Collection 'edit_diffs'

permissions =
  insert: ->
    return true
  update: ->
    return true
  remove: ->
    return true

EditDocuments.allow permissions
EditDiffs.allow permissions

EditDocuments.helpers
  editDiffs: ->
    return EditDiffs.findOne editDocId: @._id

  resetEdits: ->
    EditDiffs.remove editDocId: @._id

  dataChanges: ->
    # Calculate if we have any changes of interest.
    data = {}

    # These are the keys we'll be interested in updating
    updateKeys = _.keys @.origObj

    # Fetch @ again so we have an updated copy.
    editDiff = EditDiffs.findOne editDocId: @._id

    if editDiff
      for key in updateKeys
        if editDiff[key] isnt undefined
          # We have something to update, push it into our data
          data[key] = @[key]

    return data;

  hasChanges: ->
    return _.keys(@.dataChanges()).length > 0

  fromNowOrNow: ->
    try
      return moment(@.updatedAt).fromNowOrNow()
    catch err
      console.log err
      return '—'

# CQRS Helpers
CQRS.editHelpers = (collection) ->
  return {
    Collection: collection

    editDoc: ->
      editDoc = EditDocuments.findOne
        docId: @._id
        docType: @.type

      if editDoc
        return editDoc

      # We assign @ as a simple data type, ready for passing to the meteor
      # method.  It seems we lose the data types via passing them through.
      @.docCollection = @.Collection._collection.name

      Meteor.call('getOrCreateEditDoc', @, (error, result) -> return)

      return EditDocuments.findOne
        docId: @._id
        docType: @.type

    upsertEditDoc: (options) ->
      # Pass in changes to the Edit Document
      if @.editDocIsReady()
        console.log 'edit document is ready, upserting...'

        EditDocuments.upsert(
          docId: @._id
          docType: @.type
        ,
          options
        )
      else
        console.log 'edit document is not ready'
        # raise some kind of message / error

    commitEditDoc: ->
      # Set the Edit Document status to 'committed' and
      # allow no more changes until the status is changed
      # back to 'ready'
      EditDocument.update
        docId: @._id
        docType: @.type
        state: 'committed'

    editDocIsReady: ->
      # Return true if the Edit Document is ready for
      # collaboritive edits
      try
        return @.editDoc().state is 'ready'
      catch error
        return false
  }
