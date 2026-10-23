// Field tasks HTTP handlers.

const tasksService = require('../services/tasks.service');

async function create(req, res) {
  const task = await tasksService.createTask(req.user.id, req.params.ticketId, req.body);
  res.status(201).json(task);
}

async function listForTicket(req, res) {
  const result = await tasksService.listTasksForTicket(req.params.ticketId, req.query.page);
  res.status(200).json(result);
}

async function getById(req, res) {
  const task = await tasksService.getTaskById(req.params.id);
  res.status(200).json(task);
}

async function update(req, res) {
  const task = await tasksService.updateTask(req.user.id, req.params.id, req.body);
  res.status(200).json(task);
}

async function updateStatus(req, res) {
  const task = await tasksService.updateTaskStatus(req.user, req.params.id, req.body.status);
  res.status(200).json(task);
}

async function assign(req, res) {
  const task = await tasksService.assignTask(req.user.id, req.params.id, req.body);
  res.status(200).json(task);
}

async function unassign(req, res) {
  const task = await tasksService.unassignTask(req.user.id, req.params.id);
  res.status(200).json(task);
}

async function cancel(req, res) {
  const task = await tasksService.cancelTask(req.user.id, req.params.id);
  res.status(200).json(task);
}

module.exports = {
  create,
  listForTicket,
  getById,
  update,
  updateStatus,
  assign,
  unassign,
  cancel,
};
