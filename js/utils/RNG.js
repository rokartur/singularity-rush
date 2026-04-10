export class RNG {
  constructor(seed) {
    this.seed = seed || Date.now();
  }

  next() {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  pick(array) {
    return array[this.nextInt(0, array.length - 1)];
  }

  weightedPick(items) {
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let roll = this.next() * totalWeight;
    for (const item of items) {
      roll -= item.weight || 1;
      if (roll <= 0) return item;
    }
    return items[items.length - 1];
  }

  chance(probability) {
    return this.next() < probability;
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
