update public.influencer_campaigns
set reward_cents = 600
where title = '¿Cómo funciona Nova Digital?'
  and kind = 'views'
  and reward_cents = 430;
