// Status values and numeric ranks for ordering / integrity.

const CONNECTION_STATUS_RANK = {
  Pending: 1,
  Active: 2,
  Suspended: 3,
  Terminated: 4,
};

const TICKET_STATUS_RANK = {
  Open: 1,
  'In-Progress': 2,
  'Field Visit': 3,
  Resolved: 4,
  Closed: 5,
};

const TASK_STATUS_RANK = {
  Open: 1,
  'In-Progress': 2,
  'Field Visit': 3,
  Resolved: 4,
  Closed: 5,
  Cancelled: 6,
};

const CONNECTION_STATUSES = Object.keys(CONNECTION_STATUS_RANK);
const TICKET_STATUSES = Object.keys(TICKET_STATUS_RANK);
const TASK_STATUSES = Object.keys(TASK_STATUS_RANK);

// Tasks that still block closing a ticket.
const OPEN_TASK_STATUSES = ['Open', 'In-Progress', 'Field Visit', 'Resolved'];

module.exports = {
  CONNECTION_STATUS_RANK,
  TICKET_STATUS_RANK,
  TASK_STATUS_RANK,
  CONNECTION_STATUSES,
  TICKET_STATUSES,
  TASK_STATUSES,
  OPEN_TASK_STATUSES,
};
