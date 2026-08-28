-- A withdrawal is reserved atomically before the user confirms it by email.
-- Keep that intermediate state inside the same audited withdrawal record.
alter table public.withdrawals
  drop constraint if exists withdrawals_status_check;

alter table public.withdrawals
  add constraint withdrawals_status_check
  check (status in (
    'EMAIL_CONFIRMATION_PENDING',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'COMPLETED'
  ));

comment on constraint withdrawals_status_check on public.withdrawals is
  'Allowed lifecycle: email confirmation, admin review, approval/rejection, and settlement.';
