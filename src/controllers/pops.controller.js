// POPs HTTP handlers.

const popsService = require('../services/pops.service');

async function create(req, res) {
  const pop = await popsService.createPop(req.user.id, req.body);
  res.status(201).json(pop);
}

async function list(req, res) {
  const result = await popsService.listPops(req.query.page);
  res.status(200).json(result);
}

async function getById(req, res) {
  const pop = await popsService.getPopById(req.params.id);
  res.status(200).json(pop);
}

async function update(req, res) {
  const pop = await popsService.updatePop(req.user.id, req.params.id, req.body);
  res.status(200).json(pop);
}

async function remove(req, res) {
  const result = await popsService.softDeletePop(req.user.id, req.params.id);
  res.status(200).json(result);
}

module.exports = { create, list, getById, update, remove };
