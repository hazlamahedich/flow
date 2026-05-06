export const SAMPLE_EMAILS = {
  simple: {
    id: 'e1111111-1111-1111-1111-111111111111',
    subject: 'Meeting request',
    body_clean: 'Hi team,\n\nCan we meet tomorrow at 10am to discuss the project?\n\nThanks,\nJohn',
    workspace_id: 'w1111111-1111-1111-1111-111111111111',
    client_id: 'c1111111-1111-1111-1111-111111111111',
  },
  withQuoted: {
    id: 'e2222222-2222-2222-2222-222222222222',
    subject: 'Re: Budget approval',
    body_clean: 'Approved. Please proceed.\n\n> From: Jane\n> Sent: Monday\n> Can you approve the budget?',
    workspace_id: 'w1111111-1111-1111-1111-111111111111',
    client_id: 'c1111111-1111-1111-1111-111111111111',
  },
  multiAction: {
    id: 'e3333333-3333-3333-3333-333333333333',
    subject: 'Action required',
    body_clean: 'Please do the following:\n1. Pay the invoice\n2. Schedule the call\n3. Review the doc by Friday',
    workspace_id: 'w1111111-1111-1111-1111-111111111111',
    client_id: 'c1111111-1111-1111-1111-111111111111',
  },
};
