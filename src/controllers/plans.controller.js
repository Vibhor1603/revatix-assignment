// Plans HTTP handlers.

const plansService = require('../services/plans.service');

async function create(req, res) {
  const plan = await plansService.createPlan(req.user.id, req.body);
  res.status(201).json(plan);
}

async function list(req, res) {
  const result = await plansService.listPlans(req.query.page);
  res.status(200).json(result);
}

async function getById(req, res) {
  const plan = await plansService.getPlanById(req.params.id);
  res.status(200).json(plan);
}

async function update(req, res) {
  const plan = await plansService.updatePlan(req.user.id, req.params.id, req.body);
  res.status(200).json(plan);
}

async function remove(req, res) {
  const result = await plansService.softDeletePlan(req.user.id, req.params.id);
  res.status(200).json(result);
}

module.exports = { create, list, getById, update, remove };
