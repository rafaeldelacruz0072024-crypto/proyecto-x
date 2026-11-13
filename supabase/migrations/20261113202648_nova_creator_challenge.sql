update public.influencer_campaigns
set title = 'Reto de Creadores de Nova Digital',
    description = replace(description, 'PumpCopy', 'Nova Digital'),
    rules = replace(
      replace(rules, '#PumpCopy y #PumpCopyCreators', '#NovaDigital y #NovaDigitalCreators'),
      'PumpCopy', 'Nova Digital'
    )
where title = 'PumpCopy Creator Challenge' and kind = 'views';
