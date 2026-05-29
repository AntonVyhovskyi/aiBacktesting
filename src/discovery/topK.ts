export class TopK<T> {
  private items: T[] = [];
  constructor(
    private k: number,
    private score: (t: T) => number
  ) {}
  consider(item: T): void {
    const sc = this.score(item);
    if (this.items.length < this.k) {
      this.items.push(item);
      this.items.sort((a, b) => this.score(b) - this.score(a));
      return;
    }
    const worst = this.items[this.items.length - 1]!;
    if (sc <= this.score(worst)) return;
    this.items.pop();
    this.items.push(item);
    this.items.sort((a, b) => this.score(b) - this.score(a));
  }
  getAll(): T[] {
    return [...this.items];
  }
  best(): T | null {
    return this.items[0] ?? null;
  }
}
