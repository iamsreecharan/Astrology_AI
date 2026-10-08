const questions = [
  ['marriage', /^(?:when (?:will|might|could|can) i (?:get married|marry)|(?:at )?what age (?:will|might|could) i (?:get married|marry))$/],
  ['career', /^when (?:will|might|could|can) i (?:get|find|land) (?:a |my next )?job$/],
  ['career', /^when (?:will|might|could|can) i (?:be|get) hired$/],
  ['married-life', /^how (?:will|might|could) my (?:married life|marriage) (?:be|turn out)$/],
  ['difficult-periods', /^when (?:will|might|could) my (?:bad days|difficult period|challenging period) (?:end|ease)$/],
  [null, /^what (?:is|are) my (?:birth star|nakshatra|rashi|lagna|ascendant|nakshatra and pada)$/],
  [null, /^what is (?:a |an |the )?(?:nakshatra|dasha|lagna|ascendant|rashi|navamsa|marriage)$/],
  [null, /^(?:hi|hello|thank you|thanks)$/],
];

// Only complete, familiar questions skip the model classifier. Other turns
// still use it, including follow-ups, mixed topics and other languages.
export function fastYogiTopic(message) {
  const text = message.trim().toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  for (const [topic, pattern] of questions) {
    if (pattern.test(text)) return { resolved: true, topic };
  }
  return { resolved: false };
}
