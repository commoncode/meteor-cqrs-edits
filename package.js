Package.describe({
  summary: "Edit Documents, Diffs and Operational Transforms for CQRS"
});

Npm.depends({
    diff: "1.0.8",
});

Package.on_use(function (api) {
  api.use(['templating', 'jquery', 'mrt:moment'], 'client');
  api.use(['coffeescript', 'underscore', 'dburles:collection-helpers', 'sharejs']);

  api.add_files('lib/common.coffee', ['client', 'server']);
  api.add_files(['lib/client.html', 'lib/client.coffee'], 'client');
  api.add_files('lib/server.coffee', 'server');

  api.export(['CQRS', 'EditDiffs', 'EditDocuments']);
});
