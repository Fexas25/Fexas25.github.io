 (function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const pageKey = (function () {
    const body = document.body;
    if (!body) return "default";
    const collection = Array.from(body.classList).find((c) => c.startsWith("collection-"));
    if (collection) return collection.replace("collection-", "collection:");
    const page = Array.from(body.classList).find((c) => c.startsWith("page-"));
    if (page) return page.replace("page-", "page:");
    return "default";
  })();

  const urls = {
    "page:home": [
      "./picture/微信图片_20260128002706_37_58.jpg",
      "./picture/微信图片_20260128002707_38_58.jpg",
      "./picture/微信图片_20260128002708_39_58.jpg",
      "./picture/微信图片_20260128002710_40_58.jpg"
    ],
    "page:blog": [
      "./picture/微信图片_20260128002710_40_58.jpg",
      "./picture/微信图片_20260128002712_41_58.jpg",
      "./picture/微信图片_20260128002713_42_58.jpg",
      "./picture/微信图片_20260128002716_44_58.jpg"
    ],
    "page:cp": [
      "./picture/微信图片_20260128002716_44_58.jpg",
      "./picture/微信图片_20260128002718_45_58.jpg",
      "./picture/微信图片_20260128002722_48_58.jpg",
      "./picture/微信图片_20260128002724_49_58.jpg"
    ],
    "page:gamejam": [
      "./picture/微信图片_20260128002724_49_58.jpg",
      "./picture/微信图片_20260128002725_50_58.jpg",
      "./picture/微信图片_20260128002727_51_58.jpg",
      "./picture/微信图片_20260128002728_52_58.jpg"
    ],
    "page:projects": [
      "./picture/微信图片_20260128002728_52_58.jpg",
      "./picture/微信图片_20260128002731_54_58.jpg",
      "./picture/微信图片_20260128002731_55_58.jpg",
      "./picture/微信图片_20260128002733_56_58.jpg"
    ],
    "page:art": [
      "./picture/微信图片_20260128002733_56_58.jpg",
      "./picture/微信图片_20260128002735_57_58.jpg",
      "./picture/微信图片_20260128002736_58_58.jpg",
      "./picture/微信图片_20260128002738_59_58.jpg"
    ],
    "page:editor": [
      "./picture/微信图片_20260128002738_59_58.jpg",
      "./picture/微信图片_20260128002740_60_58.jpg",
      "./picture/微信图片_20260128002730_53_58.jpg",
      "./picture/微信图片_20260128002724_49_58.jpg"
    ],
    "page:checkin": [
      "./picture/微信图片_20260128002706_37_58.jpg",
      "./picture/微信图片_20260128002731_54_58.jpg",
      "./picture/微信图片_20260128002733_56_58.jpg",
      "./picture/微信图片_20260128002724_49_58.jpg"
    ],
    "page:post": [
      "./picture/微信图片_20260128002715_43_58.jpg",
      "./picture/微信图片_20260128002719_46_58.jpg",
      "./picture/微信图片_20260128002721_47_58.jpg",
      "./picture/微信图片_20260128002706_37_58.jpg"
    ],
    "page:page": [
      "./picture/微信图片_20260128002706_37_58.jpg",
      "./picture/微信图片_20260128002712_41_58.jpg",
      "./picture/微信图片_20260128002735_57_58.jpg",
      "./picture/微信图片_20260128002707_38_58.jpg"
    ],
    "collection:posts": [
      "./picture/微信图片_20260128002710_40_58.jpg",
      "./picture/微信图片_20260128002712_41_58.jpg",
      "./picture/微信图片_20260128002713_42_58.jpg",
      "./picture/微信图片_20260128002716_44_58.jpg"
    ],
    "collection:cp": [
      "./picture/微信图片_20260128002716_44_58.jpg",
      "./picture/微信图片_20260128002718_45_58.jpg",
      "./picture/微信图片_20260128002722_48_58.jpg",
      "./picture/微信图片_20260128002724_49_58.jpg"
    ],
    "collection:gamejam": [
      "./picture/微信图片_20260128002724_49_58.jpg",
      "./picture/微信图片_20260128002725_50_58.jpg",
      "./picture/微信图片_20260128002727_51_58.jpg",
      "./picture/微信图片_20260128002728_52_58.jpg"
    ],
    "collection:projects": [
      "./picture/微信图片_20260128002728_52_58.jpg",
      "./picture/微信图片_20260128002731_54_58.jpg",
      "./picture/微信图片_20260128002731_55_58.jpg",
      "./picture/微信图片_20260128002733_56_58.jpg"
    ],
    "collection:art": [
      "./picture/微信图片_20260128002733_56_58.jpg",
      "./picture/微信图片_20260128002735_57_58.jpg",
      "./picture/微信图片_20260128002736_58_58.jpg",
      "./picture/微信图片_20260128002738_59_58.jpg"
    ],
    default: [
      "./picture/微信图片_20260128002706_37_58.jpg",
      "./picture/微信图片_20260128002707_38_58.jpg",
      "./picture/微信图片_20260128002708_39_58.jpg",
      "./picture/微信图片_20260128002710_40_58.jpg",
      "./picture/微信图片_20260128002712_41_58.jpg",
      "./picture/微信图片_20260128002713_42_58.jpg"
    ]
  };

  const list = (urls[pageKey] || urls.default).slice();
  if (list.length < 3) return;

  if (!document.querySelector(".bg-rotator")) {
    const rotator = document.createElement("div");
    rotator.className = "bg-rotator";
    const layerA = document.createElement("div");
    const layerB = document.createElement("div");
    layerA.className = "bg-rotator__layer is-active";
    layerB.className = "bg-rotator__layer";
    rotator.append(layerA, layerB);
    document.body.prepend(rotator);
    document.body.classList.add("has-rotator");

    let idx = 0;
    let useA = true;

    const setLayer = (layer, a, b, c) => {
      layer.style.backgroundImage = `url("${a}"), url("${b}"), url("${c}")`;
    };

    const apply = (layer) => {
      const a = list[idx % list.length];
      const b = list[(idx + 1) % list.length];
      const c = list[(idx + 2) % list.length];
      setLayer(layer, a, b, c);
    };

    apply(layerA);

    setInterval(() => {
      idx = (idx + 1) % list.length;
      const next = useA ? layerB : layerA;
      const current = useA ? layerA : layerB;
      apply(next);
      next.classList.add("is-active");
      current.classList.remove("is-active");
      useA = !useA;
    }, 12000);
  }
 })();
