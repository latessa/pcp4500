# PCP Solver

A web-based solver for the Post Correspondence Problem (PCP).

## Description

This application allows users to input a set of tiles (pairs of strings) and find a solution sequence where the concatenated top strings match the concatenated bottom strings. It uses a depth-limited search algorithm implemented in JavaScript.

The solver is intended for small inputs for educational purposes. It is not optimized for performance and will likely encounter memory issues on large inputs.

## Usage

1.  Open `index.html` in a web browser.
2.  Enter the tiles in the format `top/bottom top/bottom ...`.
3.  Set the maximum depth for the search.
4.  Click "Solve PCP".
