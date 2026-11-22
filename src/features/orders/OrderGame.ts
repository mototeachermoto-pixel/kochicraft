import * as THREE from 'three';
import type { World } from '@/world/World';
import type { SpeechService } from '@/features/language/SpeechService';
import type { Region } from '@/spots/SpotDefinition';
import { blockRegistry } from '@/world/BlockRegistry';
import type { Order, OrderCell } from './orders';
import { Avatar } from '@/player/Avatar';
import { visitorDef } from '@/features/visitors/Visitors';

/**
 * ブロックのモードの「注文」ゲーム（2026-11-22）。
 *  - 右の注文書（英語）：だれの注文か・Step ごとの作り方・使うブロック・いくつ置けたか
 *  - 注文書の上の小窓：できあがりのお手本が、ゆっくり回る（今の Step は色が濃い）
 *  - 作る場所：今の Step のマスに、うすい色のお手本ブロックを出す（置けたマスは消える）
 *  - アプリが確かめる：決まったマスに決まったブロックがそろったら、次の Step へ
 *  - 全部できたら「Here you are. ～」を言って、留学生がお礼を言う
 */
export class OrderGame {
  private order: Order | null = null;
  /** 土台の左おくの角（世界のマス） */
  private readonly anchor = new THREE.Vector3();
  private step = 0;
  private done = false;

  // ===== 作る場所のうすいお手本 =====
  private readonly ghost = new THREE.Group();
  private readonly ghostGeo = new THREE.BoxGeometry(1, 1, 1);
  private readonly ghostEdge = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
  private ghostCells: { cell: OrderCell; mesh: THREE.Mesh; line: THREE.LineSegments }[] = [];
  private pulse = 0;

  // ===== 注文書 =====
  private readonly card: HTMLDivElement;
  private readonly stepsEl: HTMLDivElement;
  private readonly countEl: HTMLDivElement;
  private readonly finishEl: HTMLDivElement;

  // ===== 小窓のお手本（別のレンダラー） =====
  private readonly mini: HTMLCanvasElement;
  private miniRenderer: THREE.WebGLRenderer | null = null;
  private readonly miniScene = new THREE.Scene();
  private readonly miniCam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private readonly miniModel = new THREE.Group();
  private miniAngle = 0;

  /** 全部できてお礼を言われたとき（⭐をあげる） */
  onComplete?: () => void;
  /** Step がかわったとき（パレットをその Step のブロックに合わせる） */
  onStepBlock?: (key: string) => void;

  /** 今の Step で置けている数（数えるため） */
  private lastOk = 0;
  /** Emma のひとことまでの秒数・出しておく秒数・最後に話した時刻 */
  private talkNext = 20;
  private talkLeft = 0;
  private talkIndex = 0;
  private lastSpoke = 0;
  private readonly cheer: HTMLDivElement;
  /** 注文する人（名前ごとに1人ずつ作って使い回す） */
  private readonly people = new Map<string, Avatar>();
  private person: Avatar | null = null;
  private readonly personPos = new THREE.Vector3();
  private personYaw = 0;
  private pitch = 1.15;
  private readonly nameTag: HTMLDivElement;
  private cheerTimer = 0;
  private readonly box3 = new THREE.Box3();
  private readonly tmpV = new THREE.Vector3();
  private readonly ray = new THREE.Ray();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    hud: HTMLElement,
    private readonly speech: SpeechService,
  ) {
    scene.add(this.ghost);
    this.ghost.visible = false;

    this.card = document.createElement('div');
    this.card.className = 'order-card hidden';
    this.card.innerHTML = `
      <div class="order-card__tag">📜 Order</div>
      <canvas class="order-card__mini" width="220" height="150" aria-label="Model"></canvas>
      <div class="order-card__ask"><span class="order-card__who"></span><span class="order-card__say"></span></div>
      <div class="order-card__steps"></div>
      <div class="order-card__count"></div>
      <div class="order-card__finish hidden"></div>`;
    hud.appendChild(this.card);
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) this.card.addEventListener(ev, (e) => e.stopPropagation());
    this.mini = this.card.querySelector('canvas')!;
    // Step ができたときの、大きなほめことば（画面のまん中）
    this.cheer = document.createElement('div');
    this.cheer.className = 'order-cheer hidden';
    hud.appendChild(this.cheer);
    // 注文する人の頭の上の名前
    this.nameTag = document.createElement('div');
    this.nameTag.className = 'order-nametag hidden';
    hud.appendChild(this.nameTag);
    this.stepsEl = this.card.querySelector('.order-card__steps')!;
    this.countEl = this.card.querySelector('.order-card__count')!;
    this.finishEl = this.card.querySelector('.order-card__finish')!;

    this.miniScene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(4, 8, 6);
    this.miniScene.add(sun);
    this.miniScene.add(this.miniModel);
  }

  get active(): boolean {
    return this.order !== null;
  }

  /** 名所に入ったとき（ブロックのモードだけ）。注文がない名所なら何もしない */
  start(order: Order | undefined, field: Region | undefined, near: { x: number; y?: number; z: number }): void {
    this.stop();
    if (!order || !field) return;
    const at = this.findPlace(order, field, near);
    if (!at) return;
    this.order = order;
    this.anchor.copy(at);
    this.done = false;
    // もう作ってあるところまで進める（保存されたブロックから）
    this.step = 0;
    while (this.step < order.steps.length && this.missing(this.step) === 0) this.step++;
    this.done = this.step >= order.steps.length;
    this.lastOk = this.done ? 0 : order.steps[this.step].cells.length - this.missing(this.step);
    this.talkNext = 20;
    this.talkLeft = 0;
    this.talkIndex = Math.floor(Math.random() * order.talks.length);
    this.placePerson(order);
    this.buildMini();
    this.renderCard();
    this.buildGhost();
    this.card.classList.remove('hidden');
    this.card.classList.add('order-card--pop');
    if (!this.done) this.speech.speak(order.ask, 'en', undefined, this.pitch);
  }

  stop(): void {
    this.order = null;
    this.person?.setVisible(false);
    this.person = null;
    this.nameTag.classList.add('hidden');
    this.clearGhost();
    this.ghost.visible = false;
    this.card.classList.add('hidden');
    this.card.classList.remove('order-card--pop');
  }

  /** 作るモードのときだけ、うすいお手本を見せる */
  setBuilding(on: boolean): void {
    this.ghost.visible = on && this.order !== null && !this.done;
  }

  /** ブロックを置いた・消したあとに呼ぶ */
  check(): void {
    const o = this.order;
    if (!o || this.done) return;
    const before = this.step;
    while (this.step < o.steps.length && this.missing(this.step) === 0) this.step++;
    if (this.step >= o.steps.length) {
      this.done = true;
      this.clearGhost();
      this.ghost.visible = false;
      this.renderCard();
      this.showCheer('🎉 Perfect!', 'You did it!');
      this.speech.speak(`Perfect! You did it! Now say, ${o.finish}`, 'en', undefined, this.pitch);
      return;
    }
    if (this.step !== before) {
      this.buildGhost();
      this.praise(before + 1);
      this.onStepBlock?.(o.steps[this.step].blocks[0]);
      this.lastOk = o.steps[this.step].cells.length - this.missing(this.step);
    } else {
      this.refreshGhost();
      this.countAloud();
    }
    this.renderCard();
  }

  update(dt: number, player?: THREE.Vector3, camera?: THREE.Camera): void {
    this.updatePerson(dt, player, camera);
    if (this.cheerTimer > 0) {
      this.cheerTimer -= dt;
      if (this.cheerTimer <= 0) this.cheer.classList.add('hidden');
    }
    if (!this.order || this.card.classList.contains('hidden')) return;
    this.updateTalk(dt);
    // うすいお手本を、ゆっくり明るく・暗く（どこに置くか目に入りやすく）
    this.pulse += dt;
    const a = 0.5 + Math.sin(this.pulse * 3) * 0.15;
    for (const g of this.ghostCells) (g.mesh.material as THREE.MeshBasicMaterial).opacity = a;
    // 小窓のお手本を回す
    this.miniAngle += dt * 0.6;
    this.drawMini();
  }

  // ===== 作っている間の英語 =====
  /** 置けた数を英語で数える。半分をこえたら「Halfway! Keep going!」 */
  private countAloud(): void {
    const s = this.order!.steps[this.step];
    const total = s.cells.length;
    const ok = total - this.missing(this.step);
    const prev = this.lastOk;
    this.lastOk = ok;
    if (ok <= prev) return; // 消したときは数えない
    const half = Math.ceil(total / 2);
    if (prev < half && ok >= half && ok < total) {
      this.speakNow('Halfway! Keep going!');
      this.showCheer('💪 Halfway!', 'Keep going!');
      return;
    }
    this.speakNow(OrderGame.numberWord(ok));
  }

  private speakNow(text: string): void {
    this.lastSpoke = performance.now();
    this.speech.speak(text, 'en', undefined, this.pitch);
  }

  /** 1〜99 を英語に（One, Two, … Twenty-one） */
  private static numberWord(n: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n < 20) return ones[n] ?? String(n);
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? `-${ones[n % 10].toLowerCase()}` : '');
    return String(n);
  }

  /** 20秒に1回くらい、Emma がひとこと（注文書の「Emma」の文を少しの間かえる） */
  private updateTalk(dt: number): void {
    const o = this.order;
    if (!o || this.done) return;
    if (this.talkLeft > 0) {
      this.talkLeft -= dt;
      if (this.talkLeft <= 0) {
        this.card.querySelector('.order-card__say')!.textContent = o.ask;
        this.card.querySelector('.order-card__ask')!.classList.remove('is-talk');
      }
      return;
    }
    this.talkNext -= dt;
    if (this.talkNext > 0) return;
    // 数えている最中（2秒以内に話した）は、少し待つ
    if (performance.now() - this.lastSpoke < 2500 || this.cheerTimer > 0) {
      this.talkNext = 1.5;
      return;
    }
    const line = o.talks[this.talkIndex % o.talks.length];
    this.talkIndex++;
    const say = this.card.querySelector('.order-card__say')!;
    say.textContent = `💬 ${line}`;
    const ask = this.card.querySelector('.order-card__ask')!;
    ask.classList.remove('is-talk');
    void (ask as HTMLElement).offsetWidth;
    ask.classList.add('is-talk');
    this.speakNow(line);
    this.talkLeft = 5;
    this.talkNext = 20;
  }

  // ===== 注文する人 =====
  /** 作る場所の右どなり（まわりの空きマス）に、作る場所のほうを向いて立たせる */
  private placePerson(order: Order): void {
    const def = visitorDef(order.who);
    this.pitch = def?.pitch ?? 1.15;
    let a = this.people.get(order.who);
    if (!a) {
      a = new Avatar(this.scene, def?.look);
      this.people.set(order.who, a);
    }
    this.person = a;
    this.personPos.set(this.anchor.x + order.size.w + 0.5, this.anchor.y, this.anchor.z + order.size.d / 2);
    this.personYaw = Math.atan2(-(this.anchor.x + order.size.w / 2 - this.personPos.x), -(this.anchor.z + order.size.d / 2 - this.personPos.z));
    a.setVisible(true);
    a.update(this.personPos, this.personYaw, false, 0);
    this.nameTag.textContent = order.who;
    this.nameTag.classList.remove('hidden');
  }

  private readonly tagV = new THREE.Vector3();

  /** 近くに来たらこちらを向く（はなれたら作る場所を向く）。名前を頭の上に出す */
  private updatePerson(dt: number, player?: THREE.Vector3, camera?: THREE.Camera): void {
    const a = this.person;
    const o = this.order;
    if (!a || !o) return;
    let want = Math.atan2(-(this.anchor.x + o.size.w / 2 - this.personPos.x), -(this.anchor.z + o.size.d / 2 - this.personPos.z));
    if (player && player.distanceTo(this.personPos) < 7) want = Math.atan2(-(player.x - this.personPos.x), -(player.z - this.personPos.z));
    let d = want - this.personYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.personYaw += d * (1 - Math.exp(-6 * dt));
    a.setHappy(this.done);
    a.update(this.personPos, this.personYaw, false, dt);
    if (camera) {
      this.tagV.set(this.personPos.x, this.personPos.y + 2.25, this.personPos.z).project(camera);
      const show = this.tagV.z < 1 && Math.abs(this.tagV.x) < 1.1 && Math.abs(this.tagV.y) < 1.1;
      this.nameTag.classList.toggle('hidden', !show);
      if (show) {
        this.nameTag.style.left = `${((this.tagV.x + 1) / 2) * window.innerWidth}px`;
        this.nameTag.style.top = `${((1 - this.tagV.y) / 2) * window.innerHeight}px`;
      }
    }
  }

  // ===== ほめる =====
  private static readonly PRAISE = ['Good job!', 'Nice work!', 'Great!', 'Well done!', 'Excellent!'];

  /** Step ができた → 大きく「Good job!」＋次の Step を読み上げる（英語を聞く場面にする） */
  private praise(doneStep: number): void {
    const o = this.order!;
    this.lastSpoke = performance.now() + 3000; // ほめている間は、ひとことを出さない
    const word = OrderGame.PRAISE[(doneStep - 1 + Math.floor(Math.random() * 2)) % OrderGame.PRAISE.length];
    const next = o.steps[this.step];
    this.showCheer(`⭐ ${word}`, `Step ${doneStep} ✓`);
    this.speech.speak(`${word} Step ${this.step + 1}. ${this.say(next.text)}`, 'en', undefined, this.pitch);
  }

  /** 注文書の書き方（5 × 5）を、読み上げやすい英語に（5 by 5） */
  private say(text: string): string {
    return text.replace(/×/g, 'by');
  }

  private showCheer(big: string, small: string): void {
    this.cheer.innerHTML = `<div class="order-cheer__big">${big}</div><div class="order-cheer__small">${small}</div>`;
    this.cheer.classList.remove('hidden');
    this.cheer.classList.remove('order-cheer--pop');
    void this.cheer.offsetWidth;
    this.cheer.classList.add('order-cheer--pop');
    this.cheerTimer = 2.2;
  }

  // ===== 置くのを手伝う =====
  /**
   * 視線の先のお手本のマス（今出ている段）をさがす。
   * まっすぐ当たるマスがなくても、視線から 0.9 マス以内のいちばん近いマスを選ぶ（ねらいやすく）。
   */
  snapCell(origin: THREE.Vector3, dir: THREE.Vector3): { x: number; y: number; z: number; id: number } | null {
    if (!this.order || this.done || !this.ghost.visible) return null;
    this.ray.set(origin, this.tmpV.copy(dir).normalize());
    let best: { cell: OrderCell; score: number } | null = null;
    for (const g of this.ghostCells) {
      if (!g.mesh.visible) continue;
      const [x, y, z] = this.worldPos(g.cell);
      this.box3.min.set(x, y, z);
      this.box3.max.set(x + 1, y + 1, z + 1);
      const hit = this.ray.intersectBox(this.box3, this.tmpV);
      let score: number;
      if (hit) {
        score = hit.distanceTo(origin); // 当たっていれば近いほどよい
      } else {
        const c = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
        const off = Math.sqrt(this.ray.distanceSqToPoint(c));
        if (off > 0.9) continue;
        score = 100 + c.distanceTo(origin) + off * 10; // 当たっていないものは後回し
      }
      if (score > 14 && score < 100) continue; // 遠すぎる
      if (score >= 100 && score - 100 > 14 + 9) continue;
      if (!best || score < best.score) best = { cell: g.cell, score };
    }
    if (!best) return null;
    const [x, y, z] = this.worldPos(best.cell);
    return { x, y, z, id: blockRegistry.getByKey(best.cell.key)?.id ?? 1 };
  }

  // ===== 作る場所をさがす =====
  /** スタート地点に近く、平らで、上が空いている場所（土台の大きさ＋まわり1マス） */
  private findPlace(order: Order, field: Region, near: { x: number; y?: number; z: number }): THREE.Vector3 | null {
    const { w, d } = order.size;
    // スタート地点の地面と同じくらいの高さだけ（屋根や高い岩の上を選ばない）。見つからなければ少しずつゆるめる
    // スタート地点の足もとの高さ（屋根の下から始まる名所もあるので、上からではなく足もとから下へさがす）
    let base = -1;
    for (let y = Math.floor(near.y ?? 40); y >= 1; y--)
      if (blockRegistry.isSolid(this.world.getBlock(Math.floor(near.x), y, Math.floor(near.z)))) {
        base = y;
        break;
      }
    // 地面の高さ：スタート地点の足もとより少し上から下へさがす（高い所の飾りや見えない壁の上を拾わない）
    const from = base > 0 ? base + 5 : 40;
    const top = (x: number, z: number): number => {
      for (let y = from; y >= 1; y--) if (blockRegistry.isSolid(this.world.getBlock(x, y, z))) return y;
      return -1;
    };
    for (const tol of [1, 2, 4, 99]) {
      const at = this.searchPlace(order, field, near, top, base, tol);
      if (at) return at;
    }
    return null;
  }

  private searchPlace(
    order: Order,
    field: Region,
    near: { x: number; z: number },
    top: (x: number, z: number) => number,
    base: number,
    tol: number,
  ): THREE.Vector3 | null {
    const { w, d } = order.size;
    // 上に空いていてほしい高さ：作るものの高さ＋1（上の飾りがある名所でも置けるように）
    const need = Math.max(...order.steps.flatMap((st) => st.cells.map((c) => c.dy))) + 2;
    let best: THREE.Vector3 | null = null;
    let bestDist = Infinity;
    for (let x = field.min.x + 1; x + w + 1 <= field.max.x; x++) {
      for (let z = field.min.z + 1; z + d + 1 <= field.max.z; z++) {
        const dist = Math.hypot(x + w / 2 - near.x, z + d / 2 - near.z);
        if (dist >= bestDist || dist < 4) continue; // スタート地点の真上はさける
        const h = top(x, z);
        if (h < 1 || (base > 0 && Math.abs(h - base) > tol)) continue;
        let ok = true;
        for (let ix = -1; ix <= w && ok; ix++)
          for (let iz = -1; iz <= d && ok; iz++) {
            if (top(x + ix, z + iz) !== h) ok = false;
            else for (let y = h + 1; y <= h + need && ok; y++) if (this.world.getBlock(x + ix, y, z + iz) !== 0) ok = false;
          }
        if (ok) {
          best = new THREE.Vector3(x, h + 1, z);
          bestDist = dist;
        }
      }
    }
    return best;
  }

  // ===== 確かめる =====
  private worldPos(c: OrderCell): [number, number, number] {
    return [this.anchor.x + c.dx, this.anchor.y + c.dy, this.anchor.z + c.dz];
  }

  private isRight(c: OrderCell): boolean {
    const id = blockRegistry.getByKey(c.key)?.id;
    return id !== undefined && this.world.getBlock(...this.worldPos(c)) === id;
  }

  private missing(step: number): number {
    return this.order!.steps[step].cells.filter((c) => !this.isRight(c)).length;
  }

  // ===== うすいお手本 =====
  private clearGhost(): void {
    for (const g of this.ghostCells) {
      this.ghost.remove(g.mesh, g.line);
      (g.mesh.material as THREE.Material).dispose();
      (g.line.material as THREE.Material).dispose();
    }
    this.ghostCells = [];
  }

  private buildGhost(): void {
    this.clearGhost();
    const o = this.order;
    if (!o || this.done) return;
    for (const cell of o.steps[this.step].cells) {
      const color = blockRegistry.getColor(blockRegistry.getByKey(cell.key)?.id ?? 1);
      const mesh = new THREE.Mesh(this.ghostGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }));
      const line = new THREE.LineSegments(this.ghostEdge, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      const [x, y, z] = this.worldPos(cell);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      line.position.copy(mesh.position);
      mesh.renderOrder = 990;
      line.renderOrder = 991;
      this.ghost.add(mesh, line);
      this.ghostCells.push({ cell, mesh, line });
    }
    this.refreshGhost();
  }

  /** 置けたマスのお手本はかくす。重なって見づらくならないよう、まだできていない一番下の段だけ出す */
  private refreshGhost(): void {
    let low = Infinity;
    for (const g of this.ghostCells) if (!this.isRight(g.cell)) low = Math.min(low, g.cell.dy);
    for (const g of this.ghostCells) {
      const show = g.cell.dy === low && !this.isRight(g.cell);
      g.mesh.visible = show;
      g.line.visible = show;
    }
  }

  // ===== 注文書 =====
  private chip(key: string): string {
    const b = blockRegistry.getByKey(key);
    if (!b) return '';
    return `<span class="order-chip"><span class="order-chip__sw" style="background:${b.color}"></span>${b.nameEn}</span>`;
  }

  private renderCard(): void {
    const o = this.order;
    if (!o) return;
    this.card.querySelector('.order-card__who')!.textContent = o.who;
    this.card.querySelector('.order-card__say')!.textContent = o.ask;
    this.stepsEl.innerHTML = o.steps
      .map((s, i) => {
        const state = this.done || i < this.step ? 'is-done' : i === this.step ? 'is-now' : 'is-later';
        const mark = state === 'is-done' ? '✅' : state === 'is-now' ? '👉' : '⬜';
        return `<div class="order-step ${state}"><span class="order-step__mark">${mark}</span>
          <span class="order-step__body"><b>Step ${i + 1}</b> ${s.text}<span class="order-step__chips">${s.blocks.map((k) => this.chip(k)).join('')}</span></span></div>`;
      })
      .join('');
    if (this.done) {
      this.countEl.innerHTML = '';
      this.finishEl.classList.remove('hidden');
      this.finishEl.innerHTML = `
        <div class="order-finish__head">🎉 You did it!</div>
        <div class="order-finish__try"><span class="chat-try">💬 Say</span><b>${o.finish}</b></div>
        <button class="kc-btn order-finish__btn" data-act="said">🗣 I said it! <kbd>Enter</kbd></button>`;
      this.finishEl.querySelector('button')!.addEventListener('click', () => this.said());
      // できあがりの部分が見えるように、注文書を下までスクロール
      requestAnimationFrame(() => this.finishEl.scrollIntoView({ block: 'end', behavior: 'smooth' }));
    } else {
      this.finishEl.classList.add('hidden');
      const s = o.steps[this.step];
      const total = s.cells.length;
      const ok = total - this.missing(this.step);
      requestAnimationFrame(() => this.stepsEl.querySelector('.is-now')?.scrollIntoView({ block: 'nearest' }));
      this.countEl.innerHTML = `<div class="order-bar"><div class="order-bar__fill" style="width:${(ok / total) * 100}%"></div></div><span>${ok} / ${total}</span>`;
    }
  }

  /** できあがりの文を言った → 留学生のお礼 */
  said(): boolean {
    const o = this.order;
    if (!o || !this.done || this.finishEl.dataset.thanked === '1') return false;
    this.finishEl.dataset.thanked = '1';
    this.speech.speak(o.reply, 'en', undefined, this.pitch);
    this.finishEl.innerHTML = `<div class="order-finish__head">${o.who}: ${o.reply}</div>`;
    this.onComplete?.();
    return true;
  }

  // ===== 小窓のお手本 =====
  private buildMini(): void {
    const o = this.order!;
    this.miniModel.clear();
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    let maxY = 0;
    o.steps.forEach((s) => {
      for (const c of s.cells) {
        const id = blockRegistry.getByKey(c.key)?.id ?? 1;
        const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: blockRegistry.getColor(id), transparent: c.key === 'glass', opacity: c.key === 'glass' ? 0.6 : 1 }));
        m.position.set(c.dx - o.size.w / 2 + 0.5, c.dy + 0.5, c.dz - o.size.d / 2 + 0.5);
        this.miniModel.add(m);
        maxY = Math.max(maxY, c.dy + 1);
      }
    });
    const r = Math.max(o.size.w, o.size.d, maxY);
    // 平たいお手本（花だん・おふろ）も見えるよう、少し上から見下ろす
    this.miniCam.position.set(0, maxY * 0.9 + r * 1.1, r * 2.0);
    this.miniCam.lookAt(0, maxY * 0.4, 0);
    this.miniAngle = 0;
    this.drawMini();
  }

  private drawMini(): void {
    if (!this.miniRenderer) {
      try {
        this.miniRenderer = new THREE.WebGLRenderer({ canvas: this.mini, antialias: true, alpha: true });
        this.miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.miniRenderer.setSize(this.mini.width, this.mini.height, false);
      } catch {
        return; // 小窓が出せなくても、注文書とうすいお手本で作れる
      }
    }
    this.miniModel.rotation.y = this.miniAngle;
    this.miniRenderer.render(this.miniScene, this.miniCam);
  }
}
