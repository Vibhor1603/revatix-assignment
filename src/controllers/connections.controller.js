// Connections HTTP handlers.

const connectionsService = require('../services/connections.service');

async function create(req, res) {
  const connection = await connectionsService.createConnection(req.user.id, req.body);
  res.status(201).json(connection);
}

async function list(req, res) {
  const result = await connectionsService.listConnections(req.query);
  res.status(200).json(result);
}

async function getById(req, res) {
  const connection = await connectionsService.getConnectionById(req.params.id);
  res.status(200).json(connection);
}

async function update(req, res) {
  const connection = await connectionsService.updateConnection(
    req.user.id,
    req.params.id,
    req.body,
  );
  res.status(200).json(connection);
}

async function updateStatus(req, res) {
  const connection = await connectionsService.updateConnectionStatus(
    req.user.id,
    req.params.id,
    req.body.status,
  );
  res.status(200).json(connection);
}

async function remove(req, res) {
  const result = await connectionsService.softDeleteConnection(req.user.id, req.params.id);
  res.status(200).json(result);
}

module.exports = { create, list, getById, update, updateStatus, remove };
