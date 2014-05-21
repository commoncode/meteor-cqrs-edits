Package.describe({
  summary: "Edit Documents, Diffs and Operational Transforms for CQRS"
});

Package.on_use(function (api) {

  api.add_files('lib/common.js', ['client', 'server']);
  api.add_files('lib/client.js', 'client');
  api.add_files('lib/server.js', 'server');

});
