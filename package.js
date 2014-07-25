Package.describe({
  summary: "Edit Documents, Diffs and Operational Transforms for CQRS"
});

Npm.depends({
    diff: "1.0.8",
});

Package.on_use(function (api) {
  api.use(['templating', 'moment'], 'client');
  api.use('collection-helpers');

  api.add_files('lib/common.js', ['client', 'server']);
  api.add_files(['lib/client.html', 'lib/client.js'], 'client');
  api.add_files('lib/server.js', 'server');

  api.export(['CQRS', 'EditDiffs', 'EditDocuments']);
});
