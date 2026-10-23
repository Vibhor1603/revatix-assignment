// Sectors HTTP handlers.

const sectorsService = require('../services/sectors.service');

async function create(req, res) {
  const sector = await sectorsService.createSector(req.user.id, req.body);
  res.status(201).json(sector);
}

async function list(req, res) {
  const result = await sectorsService.listSectors(req.query.page);
  res.status(200).json(result);
}

async function getById(req, res) {
  const sector = await sectorsService.getSectorById(req.params.id);
  res.status(200).json(sector);
}

async function update(req, res) {
  const sector = await sectorsService.updateSector(req.user.id, req.params.id, req.body);
  res.status(200).json(sector);
}

async function remove(req, res) {
  const result = await sectorsService.softDeleteSector(req.user.id, req.params.id);
  res.status(200).json(result);
}

module.exports = { create, list, getById, update, remove };
