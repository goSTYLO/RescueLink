"use client";

import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

/** Scroll-scrubbed typing: one line at a time, characters staggered (no line masks). */
function attachScrollTyping(master, root, selector, at, splits, isMobile) {
  const el = root.querySelector(selector);
  if (!el) return;

  gsap.set(el, { opacity: 1, y: 0 });

  const lineSplit = new SplitText(el, { type: "lines" });
  splits.push(lineSplit);

  const lineGap = isMobile ? 0.022 : 0.03;
  const charStagger = isMobile ? 0.0035 : 0.0028;
  const lineCharDur = isMobile ? 0.05 : 0.06;

  lineSplit.lines.forEach((lineEl, lineIndex) => {
    const charSplit = new SplitText(lineEl, { type: "chars" });
    splits.push(charSplit);
    gsap.set(charSplit.chars, { opacity: 0 });

    master.to(
      charSplit.chars,
      {
        opacity: 1,
        duration: lineCharDur,
        stagger: { each: charStagger, ease: "none" },
        ease: "none",
      },
      at + lineIndex * lineGap,
    );
  });
}

function useGSAP(
  callback,
  options = {},
) {
  const deps = options.dependencies ?? [];
  const scope = options.scope;
  const ctxRef = useRef(null);
  const cleanupRef = useRef(undefined);

  useLayoutEffect(() => {
    const el =
      scope && typeof scope === "object" && "current" in scope
        ? scope.current
        : scope;
    ctxRef.current = gsap.context(() => {}, el ?? undefined);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ctxRef.current) return;
    cleanupRef.current?.();
    const ret = ctxRef.current.add(callback);
    cleanupRef.current = typeof ret === "function" ? ret : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

/** When each column enters the sticky viewport (sync with horizontal slide, not DOM order). */
function milestoneRevealProgress(item, topItems, bottomItems, isMobile) {
  const topIndex = topItems.findIndex((t) => t.id === item.id);
  if (topIndex >= 0) {
    const step = isMobile ? 0.1 : 0.08;
    return 0.05 + topIndex * step;
  }
  const bottomIndex = bottomItems.findIndex((t) => t.id === item.id);
  if (bottomIndex >= 0) {
    const step = isMobile ? 0.08 : 0.065;
    const base = isMobile ? 0.12 : 0.14;
    return base + bottomIndex * step;
  }
  return 0.5;
}

export default function Timeline({
  title = "How it works",
  periodLabel = "Report to resolution",
  topItems = [],
  bottomItems = [],
  textColor = "var(--color-foreground, #E5E7EB)",
  mutedTextColor = "var(--color-muted, #9CA3AF)",
  activeColor = "#FF4F52",
  backgroundColor = "var(--color-background, #0B1220)",
  imageUrl,
  imageAlt = "Emergency response coordination",
  duration,
  scrollDuration = 1.2,
}) {
  const sectionRef = useRef(null);
  const wholeSliderRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const animationDuration = duration ?? scrollDuration;
  const normalizedDuration = Math.max(0.2, animationDuration);
  const allJourneyItems = [...topItems, ...bottomItems];
  const revealDur = Math.min(0.08, normalizedDuration * 0.06);

  useGSAP(() => {
    const section = sectionRef.current;
    if (!section || !wholeSliderRef.current) return;

    const isMobile = window.innerWidth < 600;
    const slidePercent = isMobile ? -72 : -78;
    const lineWidth = isMobile ? "65%" : "98%";
    const slideEnd = isMobile ? "82% 50%" : "92% bottom";
    const items = allJourneyItems;

    const revealAll = () => {
      items.forEach((item) => {
        const isTop = topItems.some((topItem) => topItem.id === item.id);
        gsap.set(`.jl-${item.id}`, {
          scaleY: 1,
          transformOrigin: isTop ? "bottom bottom" : "top top",
        });
        gsap.set(`.jd-${item.id}`, { scale: 1 });
        gsap.set([`.title-${item.id}`, `.description-${item.id}`], {
          opacity: 1,
          y: 0,
          clearProps: "transform",
        });
      });
      gsap.set(".journey-line", { width: lineWidth });
      gsap.set(wholeSliderRef.current, { xPercent: slidePercent });
    };

    if (reducedMotion) {
      revealAll();
      return;
    }

    items.forEach((item) => {
      const isTop = topItems.some((topItem) => topItem.id === item.id);
      gsap.set(`.jl-${item.id}`, {
        scaleY: 0,
        transformOrigin: isTop ? "bottom bottom" : "top top",
      });
      gsap.set(`.jd-${item.id}`, { scale: 0 });
      gsap.set([`.title-${item.id}`, `.description-${item.id}`], {
        opacity: 1,
        y: 0,
      });
    });
    gsap.set(".journey-line", { width: "0%" });

    const textSplits = [];
    const master = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: slideEnd,
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    master.to(
      wholeSliderRef.current,
      { xPercent: slidePercent, ease: "none", duration: 1 },
      0,
    );
    master.to(
      ".journey-line",
      { width: lineWidth, ease: "none", duration: 0.85 },
      0,
    );

    items.forEach((item) => {
      const at = milestoneRevealProgress(item, topItems, bottomItems, isMobile);
      const lineSelector = `.jl-${item.id}`;
      const dotSelector = `.jd-${item.id}`;
      const titleSelector = `.title-${item.id}`;
      const descSelector = `.description-${item.id}`;
      const scrubEase = "none";

      master.to(
        lineSelector,
        { scaleY: 1, duration: revealDur, ease: scrubEase },
        at,
      );
      master.to(
        dotSelector,
        { scale: 1, duration: revealDur, ease: scrubEase },
        at,
      );
      attachScrollTyping(master, section, titleSelector, at, textSplits, isMobile);
      attachScrollTyping(
        master,
        section,
        descSelector,
        at + 0.032,
        textSplits,
        isMobile,
      );
    });

    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", handleResize);
    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      textSplits.forEach((split) => split?.revert?.());
      window.removeEventListener("resize", handleResize);
    };
  }, {
    dependencies: [normalizedDuration, reducedMotion, topItems, bottomItems, revealDur],
    scope: sectionRef,
  });

  const sectionStyle = { color: textColor, backgroundColor };
  const activeStyle = { backgroundColor: activeColor };
  const mutedTextStyle = { color: mutedTextColor };

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="h-[200vw] max-[600px]:h-[400vh] w-full relative"
      style={sectionStyle}
    >
      <div className="h-screen w-screen sticky top-[0%] pt-[10%] overflow-hidden max-[600px]:top-[5%]">
        <div
          ref={wholeSliderRef}
          className="mr-[2vw] flex h-[30vw] w-[240vw] items-center gap-[5vw] px-[5vw] max-[600px]:h-[80vh] max-[600px]:w-[800vw] max-[600px]:px-[7vw]"
        >
          {imageUrl ? (
            <div className="h-full w-[30vw] overflow-hidden rounded-[1vw] max-[600px]:h-[65vw] max-[600px]:w-[85vw] max-[600px]:rounded-[5vw]">
              <img
                src={imageUrl}
                alt={imageAlt}
                draggable={false}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div className="relative h-full w-full">
            <div className="w-full absolute left-0 top-[49%] translate-y-[-50%] flex items-center h-fit">
              <div
                className="h-[.8vw] max-[600px]:h-[2vw] max-[600px]:w-[2vw] w-[.8vw] rounded-full"
                style={activeStyle}
              />
              <div
                className="h-px w-[0%] rounded-full journey-line"
                style={activeStyle}
              />
              <div
                className="h-[.8vw] max-[600px]:h-[2vw] max-[600px]:w-[2vw] w-[.8vw] rounded-full"
                style={activeStyle}
              />
            </div>

            <div className="flex h-1/2 w-full items-center justify-start gap-[.5vw]">
              <div className="h-full w-[20%] pt-[2vw] max-[600px]:h-fit max-[600px]:pt-[5vw]">
                <h2 className="w-[65%] text-[3vw] leading-[0.95] max-[600px]:text-[8.5vw]">
                  {title}
                </h2>
              </div>

              <div className="w-full flex h-full gap-x-[15vw] max-[600px]:gap-x-[40vw]">
                {topItems.map((item) => (
                  <div
                    key={`top-${item.id}`}
                    className="relative h-full w-[30vw] px-[3vw] max-[600px]:flex max-[600px]:w-[70vw] max-[600px]:flex-col max-[600px]:px-[7vw]"
                  >
                    <div className="w-full absolute left-0 bottom-0 top-0 h-full">
                      <div
                        className={`size-[1vw] max-[600px]:size-[2.5vw] translate-x-[-50%] relative aspect-square rounded-full jd-${item.id}`}
                        style={activeStyle}
                      />
                      <div
                        className={`h-[94%] w-px origin-bottom rounded-full jl-${item.id}`}
                        style={activeStyle}
                      />
                    </div>

                    <div className="mt-[-1vw] space-y-[1vw] max-[600px]:mt-[-2vw]">
                      <h4
                        className={`title-${item.id} text-[2.5vw] leading-none max-[600px]:text-[6.4vw]`}
                      >
                        {item.heading}
                      </h4>
                      <p
                        className={`description-${item.id} w-[90%] text-[1.5vw] leading-[1.15] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-1/2 flex items-center justify-start w-full">
              <div className="w-[34%] pt-[2vw] max-[600px]:pt-[5vw] max-[600px]:w-[30%] h-full">
                <p
                  className="text-[1.65vw] leading-none max-[600px]:text-[4.2vw]"
                  style={mutedTextStyle}
                >
                  {periodLabel}
                </p>
              </div>

              <div className="w-full flex h-full gap-x-[20vw] ml-[7vw] max-[600px]:gap-x-[40vw] max-[600px]:ml-[7vw]">
                {bottomItems.map((item) => (
                  <div
                    key={`bottom-${item.id}`}
                    className="relative h-full w-[25vw] px-[3vw] max-[600px]:w-[70vw] max-[600px]:px-[7vw]"
                  >
                    <div className="w-full absolute left-0 bottom-[-1%] h-full">
                      <div
                        className={`h-[94%] origin-top w-px rounded-full max-[600px]:h-full jl-${item.id}`}
                        style={activeStyle}
                      />
                      <div
                        className={`size-[1vw] max-[600px]:size-[2.5vw] translate-x-[-50%] relative w-auto aspect-square rounded-full jd-${item.id}`}
                        style={activeStyle}
                      />
                    </div>

                    <div className="flex h-full w-full flex-col justify-end space-y-[1vw]">
                      <h4
                        className={`title-${item.id} text-[2.5vw] leading-none max-[600px]:text-[6.4vw]`}
                      >
                        {item.heading}
                      </h4>
                      <p
                        className={`description-${item.id} w-[90%] text-[1.5vw] leading-[1.15] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
