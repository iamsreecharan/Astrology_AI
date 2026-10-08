import test from 'node:test';
import assert from 'node:assert/strict';
import { responseLanguageFor, replyMatchesLanguage } from '../server/chat-language.mjs';
import { buildVedicMessages } from '../server/vedic-knowledge.mjs';

test('English questions use English independently of astrology names and prior language', () => {
  for (const question of ['How might my married life be?', 'When will I get a job?', 'What is my nakshatra?', 'Why?', 'Hi Charan', 'Shukra mahadasha']) {
    assert.equal(responseLanguageFor(question), 'en', question);
    for (const assistant of ['astral', 'yogi']) {
      const result = buildVedicMessages(null, {
        assistant, message: question,
        history: [{ role: 'assistant', content: 'आपके जीवन में सहयोग और समझ महत्वपूर्ण हैं।' }],
      });
      assert.equal(result.responseLanguage, 'en');
      assert.equal(JSON.parse(result.messages.at(-1).content).responseLanguage, 'en');
      assert.match(result.messages[0].content, /this turn is en \(English\)/);
      assert.doesNotMatch(result.messages[0].content, /use the most recent user language/);
    }
  }
});

test('explicit language selection wins over both speech and a written language request', () => {
  assert.equal(responseLanguageFor('How might my married life be?', 'hi-IN'), 'hi-IN');
  assert.equal(responseLanguageFor('నాకు ఉద్యోగం ఎప్పుడు వస్తుంది?', 'en-US'), 'en-US');
  assert.equal(responseLanguageFor('Please reply in Telugu.', 'fr-FR'), 'fr-FR');
});

test('a language request or translation is respected within an English question', () => {
  for (const [question, language] of [
    ['Reply in Hindi: how might my married life be?', 'hi'],
    ['How might my married life be? Please explain in Telugu.', 'te'],
    ['Please explain my chart in Kannada.', 'kn'],
    ['Please translate "good morning" into French.', 'fr'],
    ['Reply in en-US.', 'en-US'],
    ['Please reply in Esperanto.', 'auto'],
  ]) assert.equal(responseLanguageFor(question), language, question);
  assert.equal(responseLanguageFor('What does "reply in Hindi" mean?'), 'en');
  assert.equal(responseLanguageFor('Please reply in Hindi for this question.', 'auto', { allowLanguageRequests: false }), 'en');
});

test('Auto is resolved anew when a conversation changes between English and Telugu', () => {
  const questions = ['When will I get a job?', 'నాకు ఉద్యోగం ఎప్పుడు వస్తుంది?', 'How might my married life be?'];
  assert.deepEqual(questions.map(question => responseLanguageFor(question)), ['en', 'te', 'en']);
  assert.equal(responseLanguageFor('What is the Telugu word నక్షత్రం?'), 'en');
});

test('ambiguous shared scripts and other Latin languages remain available to the model', () => {
  for (const question of [
    'मेरी शादी कब होगी?', 'माझे वैवाहिक जीवन कसे असेल?',
    'मलाई काम कहिले मिल्छ?', 'متى سأحصل على وظيفة؟',
    'Quand vais-je trouver un emploi ?', '¿Cómo será mi vida matrimonial?',
    'Meri shaadi kab hogi?', 'Naku job eppudu vastundi?',
    'Gracias', 'Merci', 'Pourquoi?', 'Porquê?',
  ]) assert.equal(responseLanguageFor(question), 'auto', question);
});

test('English recovery catches a Hindi or Telugu narrative but allows names and short quotations', () => {
  const english = { language: 'en' };
  assert.equal(replyMatchesLanguage('आपके विवाह जीवन में सहयोग, साझा जिम्मेदारियाँ और समझ महत्वपूर्ण रहेंगी।', english), false);
  assert.equal(replyMatchesLanguage('మీ వైవాహిక జీవితంలో పరస్పర అవగాహన మరియు సహకారం ముఖ్యమైనవి.', english), false);
  assert.equal(replyMatchesLanguage('Your birth star is Rohini (रोहिणी). Its traditional themes include growth and care.', english), true);
  assert.equal(replyMatchesLanguage('You might use 24-11-2026 for preparation; it is not a promised job date.', english), true);
  assert.equal(replyMatchesLanguage('24-11-2026', english), true);
});

test('a selected Indian language accepts its native script and rejects a clear English narrative', () => {
  assert.equal(replyMatchesLanguage('आपके रिश्ते में सहयोग और खुलकर बात करना सहायक हो सकता है।', { language: 'hi-IN' }), true);
  assert.equal(replyMatchesLanguage('Your chart suggests that open conversation and shared responsibilities may help your marriage.', { language: 'hi-IN' }), false);
  assert.equal(replyMatchesLanguage('మీ నైపుణ్యాలను మెరుగుపరుచుకుంటూ ఉద్యోగ అవకాశాల కోసం సిద్ధంగా ఉండండి.', { language: 'te' }), true);
  assert.equal(replyMatchesLanguage('मेरी शादी के बारे में बताइए।', { language: 'te' }), false);
  assert.equal(replyMatchesLanguage('Meri shaadi kab hogi?', { language: 'hi-IN' }), true);
});
