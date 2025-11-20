# PCP Solver

A web-based solver for the Post Correspondence Problem (PCP).

## Description

This application allows users to input a set of tiles (pairs of strings) and find a solution sequence where the concatenated top strings match the concatenated bottom strings. It uses a depth-limited search algorithm implemented in JavaScript.

The solver is intended for educational purposes. For large inputs, you can switch the storage mode to use browser-backed disk storage to avoid JavaScript heap/Map limits at the cost of performance.

## Usage

1.  Open `index.html` in a web browser.
2.  Enter the tiles in the format `top/bottom top/bottom ...`.
3.  Set the maximum depth for the search.
4.  Choose a Storage Mode:
	- `In-Memory`: Fastest, but limited by JS heap (default not recommended for large inputs).
	- `IndexedDB (disk-backed)`: Slower, but can handle much larger problems by storing visited states on disk.
5.  Click "Solve PCP".
