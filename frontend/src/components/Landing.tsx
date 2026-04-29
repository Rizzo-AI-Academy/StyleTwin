import { ThemeToggle } from "../theme";

interface LandingProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function Landing({ onSignIn, onSignUp }: LandingProps) {
  return (
    <>
      <header className="header-row">
        <div className="brand">
          <h1>
            Style<span className="accent">Twin</span>
          </h1>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <button className="btn ghost" onClick={onSignIn}>
            Sign in
          </button>
          <button className="btn" onClick={onSignUp}>
            Get started
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="eyebrow">AI Personal Stylist</div>
        <h1>
          Discover your <span className="accent">signature look</span>
          <br />in one portrait.
        </h1>
        <p className="lead">
          Upload a photo and StyleTwin returns a luxury personal styling report —
          color season, hairstyle, outfit, and accessory recommendations crafted
          just for you by gpt-image-2.
        </p>
        <div className="landing-cta">
          <button className="btn lg" onClick={onSignUp}>
            Create your account
          </button>
          <button className="btn ghost lg" onClick={onSignIn}>
            I already have one
          </button>
        </div>
      </section>

      <section className="landing-demo">
        <div className="demo-eyebrow">See it in action</div>
        <h2>From a single portrait to a complete styling report</h2>
        <div className="demo-compare">
          <figure className="demo-side">
            <div className="demo-img-wrap">
              <img src="/portrait.png" alt="Original portrait input" />
            </div>
            <figcaption>
              <span className="demo-tag">Input</span>
              <span className="demo-caption">Your portrait</span>
            </figcaption>
          </figure>
          <div className="demo-arrow" aria-hidden="true">→</div>
          <figure className="demo-side">
            <div className="demo-img-wrap demo-output">
              <img src="/styletwin-1.png" alt="StyleTwin generated styling report" />
            </div>
            <figcaption>
              <span className="demo-tag accent">Output</span>
              <span className="demo-caption">Your StyleTwin report</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-features">
        <div className="feature">
          <div className="icon">◆</div>
          <h3>Personal color analysis</h3>
          <p>
            Get your seasonal palette, undertone and contrast level — the
            colors that make you shine.
          </p>
        </div>
        <div className="feature">
          <div className="icon">✦</div>
          <h3>Hairstyle &amp; outfits</h3>
          <p>
            Photorealistic mockups of hairstyles and outfit boards tailored
            to your face and body — no try-on required.
          </p>
        </div>
        <div className="feature">
          <div className="icon">✿</div>
          <h3>Editorial report</h3>
          <p>
            One polished infographic in fashion-magazine style, ready to
            download and keep.
          </p>
        </div>
      </section>

      <section className="landing-steps">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="num">1</div>
            <h3>Sign up</h3>
            <p>Create a free account with your email — takes 30 seconds.</p>
          </div>
          <div className="step">
            <div className="num">2</div>
            <h3>Upload a portrait</h3>
            <p>A clear photo of your face is all we need to start the analysis.</p>
          </div>
          <div className="step">
            <div className="num">3</div>
            <h3>Get your report</h3>
            <p>Within a minute you receive your personalized styling guide.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        © {new Date().getFullYear()} StyleTwin · Powered by gpt-image-2
      </footer>
    </>
  );
}
