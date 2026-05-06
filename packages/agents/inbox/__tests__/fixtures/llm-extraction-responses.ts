export const LLM_EXTRACTION_RESPONSES = {
  simple: {
    actions: [
      {
        actionType: 'meeting',
        description: 'Meet tomorrow at 10am to discuss the project',
        dueDate: '2026-05-07T10:00:00Z',
        contact: 'John',
        confidence: 0.95,
      },
    ],
  },
  multi: {
    actions: [
      {
        actionType: 'payment',
        description: 'Pay the invoice',
        dueDate: null,
        contact: null,
        confidence: 0.9,
      },
      {
        actionType: 'task',
        description: 'Schedule the call',
        dueDate: null,
        contact: null,
        confidence: 0.85,
      },
      {
        actionType: 'deadline',
        description: 'Review the doc',
        dueDate: '2026-05-08T23:59:59Z',
        contact: null,
        confidence: 0.8,
      },
    ],
  },
  lowConfidence: {
    actions: [
      {
        actionType: 'task',
        description: 'Maybe do something',
        dueDate: null,
        contact: null,
        confidence: 0.5,
      },
    ],
  },
  empty: {
    actions: [],
  },
};
