import { Token, TokenType } from './token';
import {
  ANCHOR_PORTS,
  ANIMATION_EFFECTS,
  ARROW_TYPES,
  DIRECTIONS,
  DOC_VERSION,
  EASINGS,
  IMAGE_FITS,
  ROUTINGS,
  SLIDE_H,
  SLIDE_W,
  TRANSITION_TYPES,
  Align,
  AnchorRef,
  AnimationEffect,
  AnimationSpec,
  AnimationTrigger,
  ArrowType,
  CodeElement,
  ConnectorElement,
  Diagnostic,
  Direction,
  Doc,
  Easing,
  Element,
  ElementType,
  FigureElement,
  FigureFunction,
  FIGURE_FUNCTIONS,
  FIGURE_KINDS,
  HtmlEmbedElement,
  ImageElement,
  ImageFit,
  FigureKind,
  LatexElement,
  PenElement,
  Point,
  Routing,
  SHAPE_KINDS,
  Shadow,
  ShapeKind,
  Slide,
  SlideTransition,
  TextBlock,
  TextElement,
  TransitionType,
} from '../model/types';
import {
  createAnimation,
  createCode,
  createConnector,
  createFigure,
  createHtmlEmbed,
  createImage,
  createLatex,
  DEFAULT_LATEX_COLOR,
  createPen,
  createShape,
  createShadow,
  createText,
  createTextBlock,
  createTransition,
} from '../model/factories';

type PropValue = string | number | boolean | string[] | number[];
type Props = Record<string, PropValue>;

interface ParsedBody {
  props: Props;
  label: TextBlock | null;
  shadow: Shadow | null;
  animations: AnimationSpec[];
  anchors: Partial<Record<'from' | 'to', AnchorRef>>;
  points: Point[] | null;
}

const BASE_KEYS = ['name', 'group', 'members', 'rotation', 'opacity', 'locked', 'hidden'];
const GEOMETRY_KEYS = ['x', 'y', 'width', 'height'];

const SHAPE_KEYS = [...BASE_KEYS, ...GEOMETRY_KEYS, 'fill', 'stroke', 'strokeWidth', 'dash', 'radius'];
const TEXT_KEYS = [
  ...BASE_KEYS,
  ...GEOMETRY_KEYS,
  'content',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'underline',
  'align',
  'lineHeight',
  'letterSpacing',
  'color',
  'autofit',
  'math',
];
const LATEX_KEYS = [...BASE_KEYS, ...GEOMETRY_KEYS, 'content', 'displayMode', 'fontSize', 'color'];
const CODE_KEYS = [
  ...BASE_KEYS,
  ...GEOMETRY_KEYS,
  'content',
  'language',
  'showLanguage',
  'theme',
  'fontSize',
  'lineNumbers',
  'color',
  'background',
];
const IMAGE_KEYS = [...BASE_KEYS, ...GEOMETRY_KEYS, 'src', 'fit', 'radius'];
const HTML_KEYS = [...BASE_KEYS, ...GEOMETRY_KEYS, 'src', 'content', 'radius'];
const FIGURE_KEYS = [
  ...BASE_KEYS,
  ...GEOMETRY_KEYS,
  'kind',
  'title',
  'axisColor',
  'gridColor',
  'accentColor',
  'titleColor',
  'fn',
  'a',
  'b',
  'c',
  'domain',
  'values',
];
const PEN_KEYS = [...BASE_KEYS, 'color', 'width', 'smoothing', 'mode', 'points'];
const CONNECTOR_KEYS = [
  ...BASE_KEYS,
  'from',
  'to',
  'routing',
  'startArrow',
  'endArrow',
  'arrowSize',
  'width',
  'dash',
  'color',
  'label',
];

const ELEMENT_KEYWORDS: Partial<Record<TokenType, ElementType>> = {
  [TokenType.KEYWORD_RECT]: 'rect',
  [TokenType.KEYWORD_ELLIPSE]: 'ellipse',
  [TokenType.KEYWORD_TRIANGLE]: 'triangle',
  [TokenType.KEYWORD_LINE]: 'line',
  [TokenType.KEYWORD_POLYGON]: 'polygon',
  [TokenType.KEYWORD_STAR]: 'star',
  [TokenType.KEYWORD_ARROW]: 'arrow',
  [TokenType.KEYWORD_CHEVRON]: 'chevron',
  [TokenType.KEYWORD_PARALLELOGRAM]: 'parallelogram',
  [TokenType.KEYWORD_TRAPEZOID]: 'trapezoid',
  [TokenType.KEYWORD_SPEECH]: 'speech',
  [TokenType.KEYWORD_TEXT]: 'text',
  [TokenType.KEYWORD_LATEX]: 'latex',
  [TokenType.KEYWORD_CODE]: 'code',
  [TokenType.KEYWORD_IMAGE]: 'image',
  [TokenType.KEYWORD_HTML]: 'html',
  [TokenType.KEYWORD_FIGURE]: 'figure',
  [TokenType.KEYWORD_PEN]: 'pen',
  [TokenType.KEYWORD_CONNECTOR]: 'connector',
};

const ID_PREFIXES = ['s', 'e', 'c', 'g', 'a'] as const;
type IdPrefix = (typeof ID_PREFIXES)[number];

function isShapeKind(type: ElementType): type is ShapeKind {
  return (SHAPE_KINDS as string[]).includes(type);
}

export class Parser {
  private pos = 0;
  errors: Diagnostic[] = [];
  private counters: Record<IdPrefix, number> = { s: 0, e: 0, c: 0, g: 0, a: 0 };
  private used = new Set<string>();
  private slideOrdinal = 0;

  constructor(private tokens: Token[]) {
    this.prescanIds();
  }

  parse(): Doc {
    const doc: Doc = {
      version: DOC_VERSION,
      title: 'Untitled deck',
      width: SLIDE_W,
      height: SLIDE_H,
      slides: [],
    };

    while (!this.check(TokenType.EOF)) {
      const before = this.pos;
      if (this.check(TokenType.KEYWORD_SLIDE)) {
        doc.slides.push(this.parseSlide());
      } else {
        this.error(`Expected 'slide' but got '${this.peek().lexeme}'`, this.peek());
        this.advance();
      }
      if (this.pos === before) this.advance();
    }
    return doc;
  }

  /* ─── slide ─── */

  private parseSlide(): Slide {
    this.expect(TokenType.KEYWORD_SLIDE);
    this.slideOrdinal += 1;
    let name = '';
    if (this.check(TokenType.STRING_LITERAL)) {
      name = this.stringValue();
    } else {
      this.error('Expected a slide name string', this.peek());
    }
    this.expect(TokenType.L_BRACE);

    let background = '#ffffff';
    let backgroundImage: string | undefined;
    let slideWidth: number | undefined;
    let slideHeight: number | undefined;
    let notes = '';
    let transition: SlideTransition = createTransition();
    let explicitId: string | undefined;
    const elements: Element[] = [];

    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      if (this.check(TokenType.KEYWORD_BACKGROUND)) {
        this.advance();
        this.expect(TokenType.COLON);
        background = this.stringValue();
        this.expect(TokenType.SEMICOLON);
      } else if (this.checkIdentifier('backgroundImage')) {
        this.advance();
        this.expect(TokenType.COLON);
        backgroundImage = this.stringValue();
        this.expect(TokenType.SEMICOLON);
      } else if (this.checkIdentifier('width') || this.checkIdentifier('height')) {
        const key = this.peek().lexeme;
        this.advance();
        this.expect(TokenType.COLON);
        if (this.check(TokenType.NUMBER_LITERAL)) {
          const value = Number(this.advance().lexeme);
          if (Number.isFinite(value) && value > 0) {
            if (key === 'width') slideWidth = Math.round(value);
            else slideHeight = Math.round(value);
          } else {
            this.error(`Slide ${key} must be a positive number`, this.peek());
          }
        } else {
          this.error(`Slide ${key} must be a number`, this.peek());
          this.advance();
        }
        this.expect(TokenType.SEMICOLON);
      } else if (this.check(TokenType.KEYWORD_TRANSITION)) {
        transition = this.parseTransition();
      } else if (this.checkIdentifier('id')) {
        this.advance();
        this.expect(TokenType.COLON);
        explicitId = this.stringValue();
        this.expect(TokenType.SEMICOLON);
      } else if (this.checkIdentifier('notes')) {
        this.advance();
        this.expect(TokenType.COLON);
        notes = this.stringValue();
        this.expect(TokenType.SEMICOLON);
      } else if (this.peekElementType()) {
        const element = this.parseElement();
        if (element) elements.push(element);
      } else {
        this.error(`Unexpected token '${this.peek().lexeme}' in slide`, this.peek());
        this.advance();
      }
      if (this.pos === before) this.advance();
    }
    this.expect(TokenType.R_BRACE);

    const id = this.makeId('s', explicitId);
    // The size override is all-or-nothing per validation; a single stray half
    // still parses but validation reports it.
    const size = slideWidth !== undefined || slideHeight !== undefined
      ? { width: slideWidth, height: slideHeight }
      : {};
    return {
      id,
      name: name || `Slide ${this.slideOrdinal}`,
      background,
      backgroundImage,
      ...size,
      notes,
      transition,
      elements,
    };
  }

  private parseTransition(): SlideTransition {
    this.expect(TokenType.KEYWORD_TRANSITION);
    this.expect(TokenType.L_BRACE);
    const transition = createTransition();

    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      if (!this.check(TokenType.IDENTIFIER)) {
        this.error('Expected a transition property', this.peek());
        this.advance();
        continue;
      }
      const key = this.advance().lexeme;
      this.expect(TokenType.COLON);
      const value = this.parseValue();
      this.expect(TokenType.SEMICOLON);

      switch (key) {
        case 'type': {
          const type = String(value) as TransitionType;
          if (TRANSITION_TYPES.includes(type)) transition.type = type;
          else this.warn(`Unknown transition "${String(value)}"`, this.peek());
          break;
        }
        case 'direction': {
          const direction = String(value) as Direction;
          if (DIRECTIONS.includes(direction)) transition.direction = direction;
          else this.warn(`Unknown direction "${String(value)}"`, this.peek());
          break;
        }
        case 'duration':
          if (typeof value === 'number') transition.duration = value;
          break;
        case 'easing': {
          const easing = String(value) as Easing;
          if (EASINGS.includes(easing)) transition.easing = easing;
          else this.warn(`Unknown easing "${String(value)}"`, this.peek());
          break;
        }
        default:
          this.warn(`Unknown transition property "${key}"`, this.peek());
      }
      if (this.pos === before) this.advance();
    }

    this.expect(TokenType.R_BRACE);
    return transition;
  }

  /* ─── element ─── */

  private parseElement(): Element | null {
    const keyword = this.advance();
    const type = ELEMENT_KEYWORDS[keyword.type];
    if (!type) return null;

    let explicitId: string | undefined;
    if (this.check(TokenType.STRING_LITERAL)) {
      explicitId = this.stringValue();
    }
    this.expect(TokenType.L_BRACE);
    const body = this.parseBody();

    const element = this.buildElement(type, explicitId, body, keyword);
    return element;
  }

  private parseBody(): ParsedBody {
    const body: ParsedBody = {
      props: {},
      label: null,
      shadow: null,
      animations: [],
      anchors: {},
      points: null,
    };

    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;

      if (this.check(TokenType.KEYWORD_ANIMATE) && this.peekNext().type === TokenType.L_BRACE) {
        body.animations.push(this.parseAnimation());
      } else if (this.check(TokenType.KEYWORD_TEXT) && this.peekNext().type === TokenType.L_BRACE) {
        body.label = this.parseTextBlock();
      } else if (this.check(TokenType.KEYWORD_SHADOW) && this.peekNext().type === TokenType.L_BRACE) {
        body.shadow = this.parseShadow();
      } else if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD_BACKGROUND)) {
        const key = this.advance().lexeme;
        this.expect(TokenType.COLON);
        if (key === 'from' || key === 'to') {
          body.anchors[key] = this.parseAnchor();
        } else if (key === 'points') {
          body.points = this.parsePoints();
        } else {
          body.props[key] = this.parseValue();
        }
        this.expect(TokenType.SEMICOLON);
      } else {
        this.error(`Unexpected token '${this.peek().lexeme}' in element`, this.peek());
        this.advance();
      }

      if (this.pos === before) this.advance();
    }

    this.expect(TokenType.R_BRACE);
    return body;
  }

  private parseTextBlock(): TextBlock {
    this.expect(TokenType.KEYWORD_TEXT);
    this.expect(TokenType.L_BRACE);
    const props: Props = {};

    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      if (!this.check(TokenType.IDENTIFIER)) {
        this.error('Expected a text property', this.peek());
        this.advance();
        continue;
      }
      const key = this.advance().lexeme;
      this.expect(TokenType.COLON);
      props[key] = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      if (this.pos === before) this.advance();
    }
    this.expect(TokenType.R_BRACE);

    return createTextBlock({
      content: this.str(props, 'content', ''),
      fontFamily: this.str(props, 'fontFamily', createTextBlock().fontFamily),
      fontSize: this.num(props, 'fontSize', 32),
      fontWeight: this.num(props, 'fontWeight', 400),
      italic: this.bool(props, 'italic', false),
      underline: this.bool(props, 'underline', false),
      align: this.align(props, 'align', 'left'),
      lineHeight: this.num(props, 'lineHeight', 1.25),
      letterSpacing: this.num(props, 'letterSpacing', 0),
      color: this.str(props, 'color', '#1a1b1e'),
      autofit: this.bool(props, 'autofit', false),
      math: this.bool(props, 'math', false),
    });
  }

  private parseShadow(): Shadow {
    this.expect(TokenType.KEYWORD_SHADOW);
    this.expect(TokenType.L_BRACE);
    const props: Props = {};
    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      if (!this.check(TokenType.IDENTIFIER)) {
        this.error('Expected a shadow property', this.peek());
        this.advance();
        continue;
      }
      const key = this.advance().lexeme;
      this.expect(TokenType.COLON);
      props[key] = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      if (this.pos === before) this.advance();
    }
    this.expect(TokenType.R_BRACE);
    return createShadow({
      x: this.num(props, 'x', 0),
      y: this.num(props, 'y', 6),
      blur: this.num(props, 'blur', 16),
      color: this.str(props, 'color', '#00000055'),
    });
  }

  private parseAnimation(): AnimationSpec {
    this.expect(TokenType.KEYWORD_ANIMATE);
    this.expect(TokenType.L_BRACE);
    const props: Props = {};
    let explicitId: string | undefined;

    while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      if (!this.check(TokenType.IDENTIFIER)) {
        this.error('Expected an animation property', this.peek());
        this.advance();
        continue;
      }
      const key = this.advance().lexeme;
      this.expect(TokenType.COLON);
      const value = this.parseValue();
      this.expect(TokenType.SEMICOLON);
      if (key === 'id') {
        if (typeof value === 'string') explicitId = value;
      } else {
        props[key] = value;
      }
      if (this.pos === before) this.advance();
    }
    this.expect(TokenType.R_BRACE);

    const effectValue = String(props['effect'] ?? 'fadeIn') as AnimationEffect;
    const effect = ANIMATION_EFFECTS.includes(effectValue) ? effectValue : 'fadeIn';
    if (!ANIMATION_EFFECTS.includes(effectValue)) {
      this.warn(`Unknown animation effect "${effectValue}", using fadeIn`, this.peek());
    }
    const triggerValue = String(props['trigger'] ?? 'afterPrevious') as AnimationTrigger;
    const trigger: AnimationTrigger = ['onClick', 'withPrevious', 'afterPrevious'].includes(triggerValue)
      ? triggerValue
      : 'afterPrevious';
    const easingValue = String(props['easing'] ?? 'easeOut') as Easing;
    const easing = EASINGS.includes(easingValue) ? easingValue : 'easeOut';
    const directionValue = String(props['direction'] ?? 'up') as Direction;
    const direction = DIRECTIONS.includes(directionValue) ? directionValue : 'up';

    return createAnimation(this.makeId('a', explicitId), {
      effect,
      trigger,
      easing,
      direction,
      duration: this.num(props, 'duration', 500),
      delay: this.num(props, 'delay', 0),
      repeat: this.num(props, 'repeat', 1),
    });
  }

  private parsePoints(): Point[] {
    this.expect(TokenType.L_BRACKET);
    const points: Point[] = [];

    while (!this.check(TokenType.R_BRACKET) && !this.check(TokenType.EOF)) {
      const before = this.pos;
      this.expect(TokenType.L_BRACE);
      let x = 0;
      let y = 0;
      let pressure = 0.5;
      let tiltX: number | undefined;
      let tiltY: number | undefined;

      while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
        const inner = this.pos;
        if (!this.check(TokenType.IDENTIFIER)) {
          this.error('Expected a point property', this.peek());
          this.advance();
          continue;
        }
        const key = this.advance().lexeme;
        this.expect(TokenType.COLON);
        const value = this.parseValue();
        this.expect(TokenType.SEMICOLON);
        if (typeof value === 'number') {
          if (key === 'x') x = value;
          else if (key === 'y') y = value;
          else if (key === 'pressure') pressure = value;
          else if (key === 'tiltX') tiltX = value;
          else if (key === 'tiltY') tiltY = value;
        }
        if (this.pos === inner) this.advance();
      }
      this.expect(TokenType.R_BRACE);

      points.push({ x, y, pressure, tiltX, tiltY });

      if (this.check(TokenType.SEMICOLON)) this.advance();
      if (this.check(TokenType.COMMA)) this.advance();
      if (this.pos === before) this.advance();
    }

    this.expect(TokenType.R_BRACKET);
    return points;
  }

  private parseAnchor(): AnchorRef {
    if (this.check(TokenType.STRING_LITERAL)) {
      const raw = this.stringValue();
      const match = /^([A-Za-z0-9_]+)(?::(top|right|bottom|left|auto))?$/.exec(raw.trim());
      if (!match) {
        this.error(`Invalid connector endpoint "${raw}"`, this.peek());
        return { kind: 'point', x: 0, y: 0 };
      }
      const port = (match[2] ?? 'auto') as (typeof ANCHOR_PORTS)[number];
      return { kind: 'element', elementId: match[1], port };
    }

    if (this.check(TokenType.L_BRACE)) {
      this.advance();
      let x = 0;
      let y = 0;
      while (!this.check(TokenType.R_BRACE) && !this.check(TokenType.EOF)) {
        const before = this.pos;
        if (!this.check(TokenType.IDENTIFIER)) {
          this.error('Expected x or y', this.peek());
          this.advance();
          continue;
        }
        const key = this.advance().lexeme;
        this.expect(TokenType.COLON);
        const value = this.parseValue();
        this.expect(TokenType.SEMICOLON);
        if (typeof value === 'number') {
          if (key === 'x') x = value;
          if (key === 'y') y = value;
        }
        if (this.pos === before) this.advance();
      }
      this.expect(TokenType.R_BRACE);
      return { kind: 'point', x, y };
    }

    this.error('Expected a connector endpoint', this.peek());
    return { kind: 'point', x: 0, y: 0 };
  }

  /* ─── build ─── */

  private buildElement(
    type: ElementType,
    explicitId: string | undefined,
    body: ParsedBody,
    keyword: Token,
  ): Element {
    const id = this.makeId(type === 'connector' ? 'c' : 'e', explicitId);
    const props = body.props;

    if (isShapeKind(type)) {
      const element = createShape(
        type,
        id,
        {
          x: this.num(props, 'x', 0),
          y: this.num(props, 'y', 0),
          width: this.num(props, 'width', 320),
          height: this.num(props, 'height', 180),
        },
        {
          ...this.geometryOverrides(props, body.animations),
          fill: this.str(props, 'fill', '#4c9aff'),
          stroke: this.str(props, 'stroke', 'none'),
          strokeWidth: this.num(props, 'strokeWidth', 0),
          dash: this.num(props, 'dash', 0),
          radius: this.num(props, 'radius', type === 'rect' ? 8 : 0),
          shadow: body.shadow,
          text: body.label,
        },
      );
      this.warnUnknown(props, SHAPE_KEYS, id, keyword);
      return element;
    }

    if (body.label) {
      this.warn('A text block is only supported inside shapes', keyword);
    }

    switch (type) {
      case 'text': {
        const element: TextElement = createText(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 700),
            height: this.num(props, 'height', 120),
          },
          this.geometryOverrides(props, body.animations),
          {
            content: this.str(props, 'content', ''),
            fontFamily: this.str(props, 'fontFamily', createTextBlock().fontFamily),
            fontSize: this.num(props, 'fontSize', 32),
            fontWeight: this.num(props, 'fontWeight', 400),
            italic: this.bool(props, 'italic', false),
            underline: this.bool(props, 'underline', false),
            align: this.align(props, 'align', 'left'),
            lineHeight: this.num(props, 'lineHeight', 1.25),
            letterSpacing: this.num(props, 'letterSpacing', 0),
            color: this.str(props, 'color', '#1a1b1e'),
            autofit: this.bool(props, 'autofit', false),
            math: this.bool(props, 'math', false),
          },
        );
        this.warnUnknown(props, TEXT_KEYS, id, keyword);
        return element;
      }
      case 'latex': {
        const element: LatexElement = createLatex(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 640),
            height: this.num(props, 'height', 140),
          },
          {
            ...this.geometryOverrides(props, body.animations),
            content: this.str(props, 'content', ''),
            displayMode: this.bool(props, 'displayMode', true),
            fontSize: this.num(props, 'fontSize', 32),
            color: this.str(props, 'color', DEFAULT_LATEX_COLOR),
          },
        );
        this.warnUnknown(props, LATEX_KEYS, id, keyword);
        return element;
      }
      case 'code': {
        const theme = this.str(props, 'theme', 'dark') === 'light' ? 'light' : 'dark';
        const element: CodeElement = createCode(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 720),
            height: this.num(props, 'height', 260),
          },
          {
            ...this.geometryOverrides(props, body.animations),
            content: this.str(props, 'content', ''),
            language: this.str(props, 'language', 'typescript'),
            showLanguage: this.bool(props, 'showLanguage', true),
            theme,
            fontSize: this.num(props, 'fontSize', 18),
            lineNumbers: this.bool(props, 'lineNumbers', true),
            color: this.str(props, 'color', '#e6e6e6'),
            background: this.str(props, 'background', '#1e1e1e'),
          },
        );
        this.warnUnknown(props, CODE_KEYS, id, keyword);
        return element;
      }
      case 'image': {
        const fitValue = this.str(props, 'fit', 'contain') as ImageFit;
        const fit: ImageFit = IMAGE_FITS.includes(fitValue) ? fitValue : 'contain';
        if (!IMAGE_FITS.includes(fitValue)) {
          this.warn(`Unknown image fit "${fitValue}", using contain`, keyword);
        }
        const element: ImageElement = createImage(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 640),
            height: this.num(props, 'height', 360),
          },
          {
            ...this.geometryOverrides(props, body.animations),
            src: this.str(props, 'src', ''),
            fit,
            radius: this.num(props, 'radius', 0),
          },
        );
        this.warnUnknown(props, IMAGE_KEYS, id, keyword);
        return element;
      }
      case 'html': {
        const element: HtmlEmbedElement = createHtmlEmbed(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 720),
            height: this.num(props, 'height', 480),
          },
          {
            ...this.geometryOverrides(props, body.animations),
            src: this.str(props, 'src', ''),
            content: this.str(props, 'content', ''),
            radius: this.num(props, 'radius', 8),
          },
        );
        this.warnUnknown(props, HTML_KEYS, id, keyword);
        return element;
      }
      case 'figure': {
        const kindValue = this.str(props, 'kind', 'graph') as FigureKind;
        const kind = FIGURE_KINDS.includes(kindValue) ? kindValue : 'graph';
        if (!FIGURE_KINDS.includes(kindValue)) {
          this.warn(`Unknown figure kind "${kindValue}", using graph`, keyword);
        }
        const fnValue = this.str(props, 'fn', 'quadratic') as FigureFunction;
        const fn = FIGURE_FUNCTIONS.includes(fnValue) ? fnValue : 'quadratic';
        if (!FIGURE_FUNCTIONS.includes(fnValue)) {
          this.warn(`Unknown figure function "${fnValue}", using quadratic`, keyword);
        }
        const element: FigureElement = createFigure(
          id,
          {
            x: this.num(props, 'x', 0),
            y: this.num(props, 'y', 0),
            width: this.num(props, 'width', 560),
            height: this.num(props, 'height', 380),
          },
          {
            ...this.geometryOverrides(props, body.animations),
            kind,
            title: this.str(props, 'title', ''),
            axisColor: this.str(props, 'axisColor', '#1a1b1e'),
            gridColor: this.str(props, 'gridColor', '#d9dde3'),
            accentColor: this.str(props, 'accentColor', '#4c9aff'),
            titleColor: this.str(props, 'titleColor', '#1a1b1e'),
            fn,
            a: this.num(props, 'a', 1),
            b: this.num(props, 'b', 0),
            c: this.num(props, 'c', 0),
            domain: this.num(props, 'domain', 5),
            values: this.numList(props, 'values', [120, 200, 90, 260, 170, 230]),
          },
        );
        this.warnUnknown(props, FIGURE_KEYS, id, keyword);
        return element;
      }
      case 'pen': {
        const mode = this.str(props, 'mode', 'pen') === 'highlighter' ? 'highlighter' : 'pen';
        const element: PenElement = createPen(id, body.points ?? [], {
          ...this.geometryOverrides(props, body.animations),
          color: this.str(props, 'color', '#1a1b1e'),
          strokeWidth: this.num(props, 'width', 3),
          smoothing: this.bool(props, 'smoothing', true),
          mode,
        });
        this.warnUnknown(props, PEN_KEYS, id, keyword);
        return element;
      }
      case 'connector': {
        if (!body.anchors.from) {
          this.error('Connector is missing "from"', keyword);
        }
        if (!body.anchors.to) {
          this.error('Connector is missing "to"', keyword);
        }
        const routingValue = this.str(props, 'routing', 'elbow') as Routing;
        const routing = ROUTINGS.includes(routingValue) ? routingValue : 'elbow';
        const startValue = this.str(props, 'startArrow', 'none') as ArrowType;
        const endValue = this.str(props, 'endArrow', 'triangle') as ArrowType;
        const element: ConnectorElement = createConnector(
          id,
          {
            from: body.anchors.from ?? { kind: 'point', x: 0, y: 0 },
            to: body.anchors.to ?? { kind: 'point', x: 0, y: 0 },
            routing,
            startArrow: ARROW_TYPES.includes(startValue) ? startValue : 'none',
            endArrow: ARROW_TYPES.includes(endValue) ? endValue : 'triangle',
          },
          {
            ...this.baseOverrides(props, body.animations),
            arrowSize: this.num(props, 'arrowSize', 14),
            width: this.num(props, 'width', 3),
            dash: this.num(props, 'dash', 0),
            color: this.str(props, 'color', '#4c9aff'),
            label: this.str(props, 'label', ''),
          },
        );
        this.warnUnknown(props, CONNECTOR_KEYS, id, keyword);
        return element;  }
}


    throw new Error(`Unsupported element type: ${String(type)}`);
  }

  private baseOverrides(props: Props, animations: AnimationSpec[]) {
    const name = this.optionalString(props, 'name');
    const group = this.optionalString(props, 'group');
    const members = this.optionalStringList(props, 'members');
    return {
      ...(name ? { name } : {}),
      ...(group ? { group } : {}),
      ...(members ? { members } : {}),
      locked: this.bool(props, 'locked', false),
      hidden: this.bool(props, 'hidden', false),
      animations,
    };
  }

  private geometryOverrides(props: Props, animations: AnimationSpec[]) {
    return {
      ...this.baseOverrides(props, animations),
      rotation: this.num(props, 'rotation', 0),
      opacity: this.num(props, 'opacity', 1),
    };
  }

  /* ─── values ─── */

  private parseValue(): PropValue {
    const token = this.peek();
    if (token.type === TokenType.STRING_LITERAL) {
      return this.stringValue();
    }
    if (token.type === TokenType.NUMBER_LITERAL) {
      this.advance();
      const value = Number(token.lexeme);
      return Number.isFinite(value) ? value : 0;
    }
    if (token.type === TokenType.BOOLEAN_LITERAL) {
      this.advance();
      return token.lexeme === 'true';
    }
    if (token.type === TokenType.L_BRACKET) {
      return this.parseListValue();
    }
    this.error(`Expected a value but got '${token.lexeme}'`, token);
    this.advance();
    return '';
  }

  /** A `[ ... ]` literal of strings (`members`) or numbers (`values`). */
  private parseListValue(): string[] | number[] {
    this.expect(TokenType.L_BRACKET);
    const strings: string[] = [];
    const numbers: number[] = [];
    let sawString = false;
    let sawNumber = false;
    while (!this.check(TokenType.R_BRACKET) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.STRING_LITERAL)) {
        strings.push(this.stringValue());
        sawString = true;
      } else if (this.check(TokenType.NUMBER_LITERAL)) {
        const value = Number(this.advance().lexeme);
        if (Number.isFinite(value)) numbers.push(value);
        sawNumber = true;
      } else {
        this.error('Expected a string or number in the list', this.peek());
        this.advance();
      }
      if (this.check(TokenType.COMMA)) this.advance();
    }
    this.expect(TokenType.R_BRACKET);
    if (sawString && sawNumber) {
      this.warn('List mixes strings and numbers; using the strings', this.peek());
      return strings;
    }
    if (sawString) return strings;
    return numbers;
  }

  private str(props: Props, key: string, fallback: string): string {
    const value = props[key];
    return typeof value === 'string' ? value : fallback;
  }

  private optionalString(props: Props, key: string): string | undefined {
    const value = props[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private optionalStringList(props: Props, key: string): string[] | undefined {
    const value = props[key];
    return Array.isArray(value) && value.every((item) => typeof item === 'string') && value.length > 0
      ? (value as string[])
      : undefined;
  }

  private numList(props: Props, key: string, fallback: number[]): number[] {
    const value = props[key];
    return Array.isArray(value) && value.every((item) => typeof item === 'number')
      ? (value as number[])
      : fallback;
  }

  private num(props: Props, key: string, fallback: number): number {
    const value = props[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private bool(props: Props, key: string, fallback: boolean): boolean {
    const value = props[key];
    return typeof value === 'boolean' ? value : fallback;
  }

  private align(props: Props, key: string, fallback: Align): Align {
    const value = props[key];
    if (value === 'left' || value === 'center' || value === 'right') return value;
    return fallback;
  }

  private stringValue(): string {
    if (!this.check(TokenType.STRING_LITERAL)) {
      this.error('Expected a string', this.peek());
      return '';
    }
    const token = this.advance();
    return token.lexeme.slice(1, -1);
  }

  /* ─── tokens ─── */

  private peekElementType(): ElementType | undefined {
    return ELEMENT_KEYWORDS[this.peek().type];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private checkIdentifier(name: string): boolean {
    const token = this.peek();
    return token.type === TokenType.IDENTIFIER && token.lexeme === name;
  }

  private peek(): Token {
    const token = this.tokens[this.pos];
    if (token) return token;
    const last = this.tokens[this.tokens.length - 1];
    return {
      type: TokenType.EOF,
      lexeme: '',
      line: last?.line ?? 1,
      column: (last?.column ?? 0) + 1,
    };
  }

  private peekNext(): Token {
    return (
      this.tokens[this.pos + 1] ?? {
        type: TokenType.EOF,
        lexeme: '',
        line: this.peek().line,
        column: this.peek().column,
      }
    );
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    if (token) this.pos += 1;
    return token ?? this.peek();
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      this.error(`Expected ${type} but got '${token.lexeme}' (${token.type})`, token);
      return token;
    }
    return this.advance();
  }

  private warnUnknown(props: Props, allowed: string[], id: string, token: Token): void {
    for (const key of Object.keys(props)) {
      if (!allowed.includes(key)) {
        this.warn(`Unknown property "${key}" on ${id}`, token);  }
}

  }

  private error(message: string, token: Token): void {
    this.errors.push({
      severity: 'error',
      phase: 'parse',
      message,
      line: token.line,
      column: token.column,
    });
  }

  private warn(message: string, token: Token): void {
    this.errors.push({
      severity: 'warning',
      phase: 'parse',
      message,
      line: token.line,
      column: token.column,
    });
  }

  /* ─── ids ─── */

  private prescanIds(): void {
    for (const token of this.tokens) {
      if (token.type !== TokenType.STRING_LITERAL) continue;
      const match = /^([a-z]+)(\d+)$/.exec(token.lexeme.slice(1, -1));
      if (!match) continue;
      const prefix = match[1] as IdPrefix;
      if (!ID_PREFIXES.includes(prefix)) continue;
      this.counters[prefix] = Math.max(this.counters[prefix], Number(match[2]));
    }
  }

  private makeId(prefix: IdPrefix, explicit?: string): string {
    if (explicit) {
      const match = /^([a-z]+)(\d+)$/.exec(explicit);
      if (match) {
        const found = match[1] as IdPrefix;
        if (ID_PREFIXES.includes(found)) {
          this.counters[found] = Math.max(this.counters[found], Number(match[2]));
        }
      }
      if (this.used.has(explicit)) {
        this.error(`Duplicate id "${explicit}"`, this.peek());
      }
      this.used.add(explicit);
      return explicit;
    }

    let value = this.counters[prefix] + 1;
    while (this.used.has(`${prefix}${value}`)) value += 1;
    this.counters[prefix] = value;
    const id = `${prefix}${value}`;
    this.used.add(id);
    return id;
  }
}
