import './About.css';

function SkyStory() {
  return <svg className="about-sky" viewBox="0 0 440 440" fill="none" aria-hidden="true">
    <defs><radialGradient id="about-sun"><stop stopColor="#f8e4ac" /><stop offset="1" stopColor="#a77d39" /></radialGradient></defs>
    <circle cx="220" cy="220" r="194" stroke="currentColor" strokeOpacity=".3" />
    <circle cx="220" cy="220" r="165" stroke="currentColor" strokeOpacity=".24" strokeDasharray="2 10" />
    <ellipse cx="220" cy="220" rx="139" ry="58" transform="rotate(-28 220 220)" stroke="currentColor" strokeOpacity=".5" />
    <ellipse cx="220" cy="220" rx="115" ry="169" transform="rotate(28 220 220)" stroke="currentColor" strokeOpacity=".26" />
    <circle cx="220" cy="220" r="45" fill="url(#about-sun)" />
    <g className="about-sky-orbit"><circle cx="83" cy="220" r="16" fill="#8b9f87" /><circle cx="342" cy="269" r="23" fill="#b59363" /><circle cx="300" cy="110" r="9" fill="#c7bda5" /></g>
    {Array.from({ length: 27 }, (_, index) => {
      const angle = index * Math.PI * 2 / 27;
      return <circle key={index} cx={220 + Math.cos(angle) * 194} cy={220 + Math.sin(angle) * 194} r={index % 3 === 0 ? 3 : 1.8} fill="currentColor" opacity=".65" />;
    })}
    <path d="M220 10v15m0 390v15M10 220h15m390 0h15" stroke="currentColor" />
  </svg>;
}

export default function About({ onExplore }: { onExplore?: () => void }) {
  return <article className="about-page" aria-labelledby="about-title">
    <header className="about-opening">
      <div><p className="eyebrow">THE SKY, THE STORY, AND YOU</p><h1 id="about-title">The universe moves in patterns.<br /><em>What might they reveal about your story?</em></h1><p className="about-lead">Some call it order. Some call it a greater power. For generations, people have looked up at the same sky and wondered how their lives fit into something so vast.</p></div>
      <SkyStory />
    </header>
    <div className="about-chapters">
      <section className="about-chapter"><span className="about-chapter-number" aria-hidden="true">01</span><div><p className="eyebrow">A BEGINNING LARGER THAN US</p><h2>First, there was a universe to wonder about.</h2><p>Modern cosmology traces our expanding universe to a hot, dense beginning. Over time, stars formed, planets took shape, and the Earth became a place where someone could finally look up and ask why.</p><p>The sky has always been more than scenery. The return of sunlight, the changing Moon, and the seasons offered people a way to recognize time before clocks existed.</p></div></section>
      <section className="about-chapter"><span className="about-chapter-number" aria-hidden="true">02</span><div><p className="eyebrow">FROM OBSERVATION TO A TRADITION</p><h2>People learned to read the rhythm.</h2><p>In India, Jyotisha became one of the Vedangas: disciplines connected with the study and practice of the Vedas. Its early calendrical work helped organize time and ritual. Observation gradually became a language of cycles, numbers, and carefully kept records.</p><p>Indian scholars such as Aryabhata and Varahamihira contributed to mathematical astronomy and the study of the heavens. The wider tradition brought together calculation, calendars, and astrological interpretation. It grew through scholarship and exchange, rather than appearing complete in a single moment.</p></div></section>
      <section className="about-chapter"><span className="about-chapter-number" aria-hidden="true">03</span><div><p className="eyebrow">A MOMENT BECOMES A CHART</p><h2>Your birth gives the story a starting point.</h2><p>A Vedic birth chart begins with a recorded date, local time, and place. These let us calculate the sky for that moment: the rising sign, the planetary positions, and the Moon’s place among twenty-seven nakshatras.</p><p>Traditional interpretations then consider houses, planetary rulers, and Vimshottari periods. For nearer planning dates, Tarabala compares the day’s Moon star with the birth star; Chandrabala compares the Moon signs. Tithi adds another part of the lunar cycle. Each factor has a place in the explanation.</p></div></section>
      <section className="about-chapter"><span className="about-chapter-number" aria-hidden="true">04</span><div><p className="eyebrow">AN OLD QUESTION, A NEW WAY TO EXPLORE</p><h2>Calculation gives us a map. Meaning takes care.</h2><p>Astral brings these steps together using approximate Lahiri sidereal calculations, D1 and D9 charts, dated periods, and clearly stated traditional rules. AI Yogi explains the calculated facts in a conversation you can read and hear.</p><p>We can measure where planets are. What those patterns mean for a person belongs to astrological interpretation; mathematics alone does not prove a future event. That is why a useful reading gives context, conditional periods, and reasons while leaving room for choices and real opportunities.</p></div></section>
    </div>
    <aside className="about-invitation"><p>The sky has a rhythm.<br /><em>Your story still has room to unfold.</em></p>{onExplore && <button className="primary-button" onClick={onExplore}>Explore your birth chart <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>}</aside>
    <details className="about-sources"><summary>History, sources, and calculation notes</summary><p>These references provide background on the universe, Indian scholarship, and the methods used here.</p><ul>
      <li><a href="https://science.nasa.gov/universe/the-big-bang/" target="_blank" rel="noopener noreferrer">NASA: the Big Bang and our expanding universe</a></li>
      <li><a href="https://www.britannica.com/topic/Vedanga" target="_blank" rel="noopener noreferrer">Encyclopaedia Britannica: the Vedangas</a></li>
      <li><a href="https://mathshistory.st-andrews.ac.uk/Biographies/Aryabhata_I/" target="_blank" rel="noopener noreferrer">University of St Andrews, MacTutor: Aryabhata</a> · <a href="https://mathshistory.st-andrews.ac.uk/Biographies/Varahamihira/" target="_blank" rel="noopener noreferrer">Varahamihira</a></li>
      <li><a href="https://github.com/iamsreecharan/Astrology_AI/blob/main/docs/VEDIC.md" target="_blank" rel="noopener noreferrer">Astral: calculation methods, precision, and interpretation limits</a></li>
    </ul></details>
  </article>;
}
