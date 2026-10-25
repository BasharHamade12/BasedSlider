# DSL grammar reference

## Program

```
Program := Slide+
```

## Slide

```
Slide := 'slide' STRING '{' SlideProperty* '}'

SlideProperty :=
    'background' ':' Color ';'
  | 'backgroundImage' ':' STRING ';'
  | 'width' ':' NUMBER ';'
  | 'height' ':' NUMBER ';'
  | 'notes' ':' STRING ';'
  | TransitionBlock
  | Element
```

`background` defaults to `"#ffffff"`. `backgroundImage` is optional: a full-bleed data-URL image (usually a PDF import page) drawn contain-fit behind all elements. `width`/`height` are optional together and override the deck's 1920×1080 canvas for that slide (PDF import sets them from the page). `notes` is speaker notes, editor-only.

```
TransitionBlock := 'transition' '{'
    ('type' ':' ('none'|'fade'|'slide'|'push'|'zoom') ';')?
    ('direction' ':' ('up'|'down'|'left'|'right') ';')?
    ('duration' ':' NUMBER ';')?
    ('easing' ':' Easing ';')?
'}'
```

## Elements

All elements accept `id`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `locked`, `hidden`, `group`, `members`, `name`, and repeatable `animate { }` blocks.

```
Element :=
    ShapeElement | TextElement | LatexElement | CodeElement | ImageElement
  | HtmlEmbedElement | PenElement | ConnectorElement
```

### Shape (`rect`, `ellipse`, `triangle`, `line`, `polygon`, `star`, `arrow`, `chevron`, `parallelogram`, `trapezoid`, `speech`)

```
rect "e1" {
    x: 100; y: 100; width: 400; height: 200;
    fill: "#ff0000"; stroke: "#000000"; strokeWidth: 2;
    radius: 12; dash: 0;
    text { content: "Label"; fontSize: 24; color: "#ffffff"; align: "center"; }
}
```

`fill` also accepts `linear-gradient(<angle>deg, <color>, <color>)`.
`shadow` accepts `{ x: 0; y: 4; blur: 12; color: "#00000055"; }`.

### Text

```
text "e2" {
    x: 100; y: 600;
    content: "Hello\nworld";
    fontFamily: "Inter, sans-serif"; fontSize: 48; fontWeight: 400;
    italic: false; underline: false; align: "left";
    lineHeight: 1.25; letterSpacing: 0; color: "#ffffff"; autofit: false;
    math: false;
}
```

Text has no explicit width unless measured; `width` acts as the wrap width.
With `math: true` each `$…$` span in `content` renders as inline KaTeX at the
block font size (same option as the properties-panel "Math mode" toggle on
text and shape labels).

### LaTeX

```
latex "e3" {
    x: 100; y: 100;
    content: "\\sum_{i=1}^n i = \\frac{n(n+1)}{2}";
    displayMode: true; fontSize: 32;
    color: "#1a1b1e";    // defaults to #1a1b1e, serialized only when it differs
}
```

### Code

```
code "e4" {
    x: 100; y: 100;
    content: "const x = 1;\nconsole.log(x);";
    language: "typescript"; theme: "dark"; fontSize: 18; lineNumbers: true;
}
```

### Image

```
image "e6" {
    x: 460; y: 300; width: 1000; height: 480;
    src: "https://example.com/chart.png";
    fit: "cover";      // contain | cover | fill
    radius: 12;
}
```

`src` is a URL or a `data:` URL, so an exported `.slide` file carries its
images with it. An empty `src` draws a placeholder box. `fit` defaults to
`contain` and maps to the SVG `preserveAspectRatio` (`meet`, `slice`, `none`).
`radius` defaults to `0` and rounds the corners by clipping the image.

### HTML embed

```
html "e7" {
    x: 620; y: 220; width: 560; height: 480;
    src: "https://example.com/live-widget";
    radius: 8;
}
```

`src` embeds an external page; `content` (a STRING of inline HTML source) is
mutually exclusive and wins when both are set — the serializer only emits `src`
when `content` is empty. `radius` defaults to `8`. An embed with neither source
renders a placeholder box and warns. `reloadToken` is editor-internal and is
never serialized.

### Pen

```
pen "e5" {
    color: "#000000"; width: 3; smoothing: true; mode: "pen";
    points: [
        { x: 10; y: 20; pressure: 0.5; },
    ];
}
```

`mode` is `pen` or `highlighter`. `width` is the stroke thickness and maps to `pen.strokeWidth`; it is unrelated to the element's bounding width. Bounds (`x`, `y`, `width`, `height`) are derived from the points when parsed, so they are not serialized.

### Connector

```
connector "c1" {
    from: "e1:right";
    to: "e2:left";
    routing: "elbow";
    startArrow: "none"; endArrow: "triangle";
    arrowSize: 12; width: 2; dash: 0; color: "#4c9aff";
    label: "queries";
}
```

Endpoints are `"elementId:port"` or `{ x: 10; y: 20; }`. Ports: `top`, `right`, `bottom`, `left`, `auto`.
Routing: `straight`, `elbow`, `curved`.
Arrowheads: `none`, `triangle`, `open`, `diamond`, `circle`, `bar`.

### Animation

```
animate {
    effect: "fadeIn";
    trigger: "onClick";     // onClick | withPrevious | afterPrevious
    duration: 500;          // ms
    delay: 0;               // ms
    easing: "easeOut";
    direction: "up";        // for slideIn/slideOut
    repeat: 1;
}
```

Enter effects: `fadeIn`, `slideIn`, `zoomIn`, `drawLine`.
Exit effects: `fadeOut`, `slideOut`, `zoomOut`.
Emphasis effects: `pulse`, `bounce`, `spin`, `flash`.

### Group

Grouping is a property, not an element: every element sharing `group: "g1"` moves, selects, deletes and duplicates as one unit. The group's lead — the member with the lowest numeric id — also carries the explicit member list:

```
rect "e1" {
    group: "g1";
    members: [ "e2", "e3" ];
}
```

Non-leads repeat only the `group` tag. The list is optional (tag-only groups from older decks still work); the serializer emits `group` after `name`, then `members` when the element is the lead. Deleting a member repairs the lead list; validation errors on member ids that don't exist on the slide.

### Figure

```
figure "f1" {
    x: 80; y: 90; width: 560; height: 380;
    kind: "graph";              // 'axes' | 'plane' | 'graph' | 'barchart'
    title: "Sine wave";
    fn: "sine";                 // graph: 'line' | 'quadratic' | 'cubic' | 'sine' | 'exp'
    a: 2; b: 1.5; c: 0.5;
    domain: 8;
    values: [ 10, 30, 20, 45 ];// barchart
    axisColor: "#1a1b1e";
    gridColor: "#d9dde3";
    accentColor: "#4c9aff";
    titleColor: "#1a1b1e";
}
```

One self-contained element: the canvas draws axes/grid/curve/bars from the properties, so moving/resizing reshapes the whole drawing. `fn`/`a`/`b`/`c`/`domain` apply to `graph`, `values` to `barchart`. Unknown `kind`/`fn` values warn and fall back to `graph`/`quadratic`.

## Values

- `STRING` — double-quoted or backtick-quoted; multiline allowed; escapes `\\ \" \n \r \t`.
- `NUMBER` — `-?digits(.digits)?`
- `BOOLEAN` — `true` / `false`
- `Easing` — `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `backOut`
