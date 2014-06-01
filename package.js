console.log('cqrs-edits package.js');

Package.describe({
  summary: "Edit Documents, Diffs and Operational Transforms for CQRS"
});

Npm.depends({
    diff: "1.0.8",
});

Package.on_use(function (api) {

  api.use(['templating'], 'client');

  // Load this before client.js so we have Template loaded.
  api.add_files('lib/client.html', 'client');

  api.add_files('lib/common.js', ['client', 'server']);
  api.add_files('lib/client.js', 'client');
  api.add_files('lib/server.js', 'server');


  api.export('diffParts', 'client');
  api.export('editActions', 'server');
  api.export('EditDiffs', ['client', 'server']);
  api.export('editDocFormControls', 'client');
  api.export('editDocFormInput', 'client');
  api.export('editDocsCursor', 'server');
  api.export('EditDocuments', ['client', 'server']);
  api.export('editEvents', 'client');
  api.export('editHelpers', ['client', 'server']);
  api.export('editStates', 'server');

});
