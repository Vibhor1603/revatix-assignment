// Technicians and shifts HTTP handlers.

const techniciansService = require('../services/technicians.service');

async function list(req, res) {
  const result = await techniciansService.listTechnicians(req.query.page);
  res.status(200).json(result);
}

async function create(req, res) {
  const tech = await techniciansService.createTechnician(req.user.id, req.body);
  res.status(201).json(tech);
}

async function createShift(req, res) {
  const shift = await techniciansService.createShift(req.user.id, req.params.id, req.body);
  res.status(201).json(shift);
}

async function listShifts(req, res) {
  const result = await techniciansService.listShifts(req.user, req.params.id, req.query.page);
  res.status(200).json(result);
}

async function removeShift(req, res) {
  const result = await techniciansService.softDeleteShift(
    req.user.id,
    req.params.id,
    req.params.shiftId,
  );
  res.status(200).json(result);
}

module.exports = { list, create, createShift, listShifts, removeShift };
