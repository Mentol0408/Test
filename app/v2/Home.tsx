import { Navbar } from "./components/Navbar";
import { Marquee } from "./components/Marquee";
import { PageAtmosphere } from "./components/Effects";
import { Hero } from "./components/sections/Hero";
import { Servers } from "./components/sections/Servers";
import { FeaturesBento } from "./components/sections/FeaturesBento";
import { LiveStats } from "./components/sections/LiveStats";
import { Gallery } from "./components/sections/Gallery";
import { Trailer } from "./components/sections/Trailer";
import { Community } from "./components/sections/Community";
import { FAQ } from "./components/sections/FAQ";
import { FinalCTA } from "./components/sections/FinalCTA";
import { Footer } from "./components/sections/Footer";

/** The full Rust Way redesigned homepage composition (shared by / and /v2). */
export function HomeV2() {
  return (
    <main className="relative isolate overflow-x-clip">
      <PageAtmosphere />
      <Navbar />
      <Hero />
      <Marquee />
      <Servers />
      <FeaturesBento />
      <LiveStats />
      <Gallery />
      <Trailer />
      <Community />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
