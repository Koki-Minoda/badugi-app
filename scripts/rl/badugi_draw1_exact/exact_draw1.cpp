// Exact one-draw Badugi score distributions for every keep mask of supplied hands.
// Input: whitespace-separated four ascending card ids (rank * 4 + suit).
// Output: binary header (number of score keys, score key array), then per hand
// four card ids and 16 x score-key-count little-endian uint32 counts.
// The initial four cards remain excluded from the 48-card draw deck even when
// discarded. This is a card combinatorics diagnostic, not an action EV.
#include <algorithm>
#include <array>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <vector>

using namespace std;
static int choose_table[53][5];
static uint32_t score_code(const array<int, 4>& h) {
  uint32_t best = 0;
  for (int mask = 1; mask < 16; ++mask) {
    int ranks[4], n = 0, rank_bits = 0, suit_bits = 0;
    bool legal = true;
    for (int i = 0; i < 4; ++i) if (mask & (1 << i)) {
      int r = h[i] / 4, s = h[i] % 4;
      if ((rank_bits & (1 << r)) || (suit_bits & (1 << s))) { legal = false; break; }
      rank_bits |= 1 << r; suit_bits |= 1 << s; ranks[n++] = r;
    }
    if (!legal) continue;
    sort(ranks, ranks + n, greater<int>());
    uint32_t code = n;
    for (int i = 0; i < 4; ++i) code = code * 14 + (i < n ? 13 - ranks[i] : 0);
    if (code > best) best = code;
  }
  return best;
}
static inline int index4(const array<int, 4>& h) {
  return choose_table[h[0]][1] + choose_table[h[1]][2]
       + choose_table[h[2]][3] + choose_table[h[3]][4];
}
static void write_u32(uint32_t x) { cout.write(reinterpret_cast<const char*>(&x), 4); }

int main() {
  for (int n = 0; n <= 52; ++n) {
    choose_table[n][0] = 1;
    for (int k = 1; k <= 4; ++k) choose_table[n][k] = k > n ? 0
      : (k == n ? 1 : (n ? choose_table[n - 1][k - 1] + choose_table[n - 1][k] : 0));
  }
  constexpr int HANDS = 270725;
  vector<uint32_t> score(HANDS), keys;
  vector<int> code_to_id(5 * 14 * 14 * 14 * 14 + 1, -1);
  for (int a = 0; a < 49; ++a) for (int b = a + 1; b < 50; ++b)
    for (int c = b + 1; c < 51; ++c) for (int d = c + 1; d < 52; ++d) {
      array<int, 4> h{a,b,c,d};
      score[index4(h)] = score_code(h);
      keys.push_back(score[index4(h)]);
    }
  sort(keys.begin(), keys.end());
  keys.erase(unique(keys.begin(), keys.end()), keys.end());
  for (int i = 0; i < static_cast<int>(keys.size()); ++i) code_to_id[keys[i]] = i;
  vector<uint16_t> score_id(HANDS);
  for (int i = 0; i < HANDS; ++i) score_id[i] = code_to_id[score[i]];
  write_u32(keys.size());
  for (uint32_t key : keys) write_u32(key);
  cerr << "score_keys=" << keys.size() << "\n";

  array<int, 4> initial;
  uint64_t hands = 0, outcomes = 0;
  auto started = chrono::steady_clock::now();
  while (cin >> initial[0] >> initial[1] >> initial[2] >> initial[3]) {
    if (!(0 <= initial[0] && initial[0] < initial[1] && initial[1] < initial[2]
          && initial[2] < initial[3] && initial[3] < 52)) return 2;
    for (int x : initial) write_u32(x);
    int remaining[48], pos = 0;
    for (int c = 0; c < 52; ++c)
      if (c != initial[0] && c != initial[1] && c != initial[2] && c != initial[3]) remaining[pos++] = c;
    if (pos != 48) return 3;
    for (int mask = 0; mask < 16; ++mask) {
      int keep[4], nk = 0;
      for (int i = 0; i < 4; ++i) if (mask & (1 << i)) keep[nk++] = initial[i];
      int draw = 4 - nk;
      vector<uint32_t> histogram(keys.size());
      if (draw == 0) {
        ++histogram[score_id[index4(initial)]];
      } else {
        int ix[4] = {0,1,2,3};
        while (true) {
          array<int, 4> final;
          for (int i = 0; i < nk; ++i) final[i] = keep[i];
          for (int i = 0; i < draw; ++i) final[nk + i] = remaining[ix[i]];
          sort(final.begin(), final.end());
          ++histogram[score_id[index4(final)]];
          int p = draw - 1;
          while (p >= 0 && ix[p] == 48 - draw + p) --p;
          if (p < 0) break;
          ++ix[p];
          for (int i = p + 1; i < draw; ++i) ix[i] = ix[i - 1] + 1;
        }
      }
      uint32_t sum = 0;
      for (auto v : histogram) { write_u32(v); sum += v; }
      if (sum != static_cast<uint32_t>(choose_table[48][draw])) return 4;
      outcomes += sum;
    }
    ++hands;
    if (hands % 1000 == 0) {
      double sec = chrono::duration<double>(chrono::steady_clock::now() - started).count();
      cerr << "hands=" << hands << " outcomes=" << outcomes << " seconds=" << sec << "\n";
    }
  }
  double sec = chrono::duration<double>(chrono::steady_clock::now() - started).count();
  cerr << "DONE hands=" << hands << " outcomes=" << outcomes << " seconds=" << sec << "\n";
}
