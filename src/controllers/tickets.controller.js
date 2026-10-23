// Tickets HTTP handlers.

const ticketsService = require('../services/tickets.service');

async function create(req, res) {
  const ticket = await ticketsService.createTicket(req.user.id, req.body);
  res.status(201).json(ticket);
}

async function list(req, res) {
  const result = await ticketsService.listTickets(req.query);
  res.status(200).json(result);
}

async function getById(req, res) {
  const ticket = await ticketsService.getTicketById(req.params.id);
  res.status(200).json(ticket);
}

async function update(req, res) {
  const ticket = await ticketsService.updateTicket(req.user.id, req.params.id, req.body);
  res.status(200).json(ticket);
}

async function updateStatus(req, res) {
  const ticket = await ticketsService.updateTicketStatus(
    req.user.id,
    req.params.id,
    req.body.status,
  );
  res.status(200).json(ticket);
}

module.exports = { create, list, getById, update, updateStatus };
