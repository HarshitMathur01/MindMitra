export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 500 540"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A watercolor tree with falling leaves and birds, a quiet figure resting beneath it"
      className="h-full w-full"
    >
      <defs>
        {/* Strong watercolor warp — soft organic edges for canopy blobs */}
        <filter
          id="qc-water"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014"
            numOctaves="3"
            seed="11"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Secondary warp — smaller scale for cross-bleed splotches */}
        <filter
          id="qc-water-2"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="3"
            seed="5"
          />
          <feDisplacementMap in="SourceGraphic" scale="14" />
        </filter>

        {/* Light warp — for the person and small details */}
        <filter
          id="qc-water-soft"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="2"
            seed="3"
          />
          <feDisplacementMap in="SourceGraphic" scale="4" />
        </filter>

        {/* Tiny warp — pencil-sketch wobble for the trunk */}
        <filter
          id="qc-pencil"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="2"
            seed="9"
          />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>

        <symbol id="qc-leaf" viewBox="0 0 14 7" overflow="visible">
          <path
            d="M 0 3.5 Q 2 0 7 0 Q 12 0 14 3.5 Q 12 7 7 7 Q 2 7 0 3.5 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.3"
            strokeOpacity="0.8"
          />
        </symbol>

        <symbol id="qc-leaf-outline" viewBox="0 0 14 7" overflow="visible">
          <path
            d="M 0 3.5 Q 2 0 7 0 Q 12 0 14 3.5 Q 12 7 7 7 Q 2 7 0 3.5 Z M 1 3.5 L 13 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
      </defs>

      {/* faint paper-tone background — keeps illustration warm even on white */}
      <rect x="0" y="0" width="500" height="540" fill="#F5EDE0" />

      {/* LAYER 1 — main canopy washes with darker rim (pigment-pool feel) */}
      <g filter="url(#qc-water)">
        {/* olive-sage centre */}
        <ellipse
          cx="245"
          cy="195"
          rx="135"
          ry="115"
          fill="#9CAB8B"
          fillOpacity="0.55"
          stroke="#7C8E6E"
          strokeWidth="2.5"
          strokeOpacity="0.32"
        />
        {/* peach upper right */}
        <ellipse
          cx="345"
          cy="175"
          rx="80"
          ry="82"
          fill="#DEB69B"
          fillOpacity="0.62"
          stroke="#C2967B"
          strokeWidth="2.5"
          strokeOpacity="0.36"
        />
        {/* dusty teal-blue lower left */}
        <ellipse
          cx="155"
          cy="245"
          rx="80"
          ry="75"
          fill="#94A8AE"
          fillOpacity="0.5"
          stroke="#778A90"
          strokeWidth="2.5"
          strokeOpacity="0.34"
        />
        {/* soft sage top */}
        <ellipse
          cx="240"
          cy="115"
          rx="95"
          ry="50"
          fill="#B5C2A6"
          fillOpacity="0.42"
          stroke="#94A289"
          strokeWidth="2"
          strokeOpacity="0.25"
        />
      </g>

      {/* LAYER 2 — secondary blobs for color depth + splatter */}
      <g filter="url(#qc-water-2)">
        <ellipse
          cx="300"
          cy="260"
          rx="65"
          ry="50"
          fill="#9CAB8B"
          fillOpacity="0.42"
          stroke="#7C8E6E"
          strokeWidth="1.6"
          strokeOpacity="0.22"
        />
        <ellipse
          cx="200"
          cy="155"
          rx="55"
          ry="48"
          fill="#DEB69B"
          fillOpacity="0.38"
          stroke="#C2967B"
          strokeWidth="1.6"
          strokeOpacity="0.22"
        />
        <ellipse
          cx="385"
          cy="240"
          rx="55"
          ry="55"
          fill="#A8BC9A"
          fillOpacity="0.35"
        />
        <ellipse
          cx="125"
          cy="180"
          rx="40"
          ry="35"
          fill="#94A8AE"
          fillOpacity="0.35"
        />
        {/* small splatter near edges */}
        <ellipse cx="80" cy="305" rx="14" ry="10" fill="#94A8AE" fillOpacity="0.4" />
        <ellipse cx="430" cy="180" rx="10" ry="8" fill="#DEB69B" fillOpacity="0.45" />
        <ellipse cx="410" cy="290" rx="13" ry="9" fill="#9CAB8B" fillOpacity="0.35" />
      </g>

      {/* LAYER 3 — tree trunk + branches (pencil line, slight wobble) */}
      <g filter="url(#qc-pencil)">
        <g
          stroke="#6B6259"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.88"
        >
          {/* main trunk — tapered, slight S-curve */}
          <path
            strokeWidth="2.4"
            d="M 244 415 C 246 390, 248 365, 246 335 C 244 305, 250 275, 248 240 C 247 220, 250 200, 248 175"
          />
          <path
            strokeWidth="1.4"
            d="M 252 415 C 252 390, 254 365, 252 335 C 252 305, 256 275, 254 240 C 254 220, 256 200, 254 175"
            opacity="0.6"
          />

          {/* left major branches */}
          <path strokeWidth="1.6" d="M 248 290 C 230 275, 208 255, 185 230 C 175 220, 165 215, 152 208" />
          <path strokeWidth="1.4" d="M 248 320 C 220 318, 188 308, 150 288 C 138 282, 130 280, 122 278" />
          <path strokeWidth="1.5" d="M 248 245 C 230 218, 215 188, 200 158 C 195 148, 192 142, 188 138" />
          <path strokeWidth="1.2" d="M 248 270 C 232 250, 215 235, 195 222" />

          {/* right major branches */}
          <path strokeWidth="1.6" d="M 252 290 C 270 275, 292 255, 318 230 C 328 220, 338 215, 350 208" />
          <path strokeWidth="1.4" d="M 252 320 C 280 318, 312 308, 350 288 C 362 282, 370 280, 378 278" />
          <path strokeWidth="1.5" d="M 252 245 C 270 218, 285 188, 300 158 C 305 148, 308 142, 312 138" />
          <path strokeWidth="1.2" d="M 252 270 C 268 250, 285 235, 305 222" />

          {/* finer twigs */}
          <path strokeWidth="0.9" d="M 200 215 C 192 205, 184 198, 175 192" />
          <path strokeWidth="0.9" d="M 300 215 C 308 205, 316 198, 325 192" />
          <path strokeWidth="0.9" d="M 246 200 C 242 178, 238 158, 234 142" />
          <path strokeWidth="0.9" d="M 254 200 C 258 178, 262 158, 266 142" />
          <path strokeWidth="0.8" d="M 175 250 C 168 246, 160 244, 152 244" />
          <path strokeWidth="0.8" d="M 325 250 C 332 246, 340 244, 348 244" />
          <path strokeWidth="0.7" d="M 220 195 C 216 185, 213 175, 211 168" />
          <path strokeWidth="0.7" d="M 280 195 C 284 185, 287 175, 289 168" />
          <path strokeWidth="0.8" d="M 152 208 C 144 205, 138 204, 132 204" />
          <path strokeWidth="0.8" d="M 348 208 C 356 205, 362 204, 368 204" />

          {/* subtle bark suggestion — short marks on trunk */}
          <path strokeWidth="0.6" d="M 247 360 q 1 4 0 8" opacity="0.5" />
          <path strokeWidth="0.6" d="M 251 320 q -1 4 0 8" opacity="0.5" />
          <path strokeWidth="0.6" d="M 248 280 q 1 3 0 6" opacity="0.5" />
        </g>
      </g>

      {/* LAYER 4 — leaves on branches (outlined, hand-drawn feel) */}
      <g opacity="0.65" stroke="#7A736A" strokeWidth="0.5" fill="none" strokeLinecap="round">
        {/* clusters near branch tips */}
        <path d="M 188 138 q 4 -5 8 -2 q 3 3 -1 6 q -4 2 -7 -1 q -2 -2 0 -3 z" />
        <path d="M 312 138 q 4 -5 8 -2 q 3 3 -1 6 q -4 2 -7 -1 q -2 -2 0 -3 z" />
        <path d="M 175 192 q 5 -4 9 0 q 2 4 -3 5 q -5 1 -7 -3 q -1 -2 1 -2 z" />
        <path d="M 325 192 q 5 -4 9 0 q 2 4 -3 5 q -5 1 -7 -3 q -1 -2 1 -2 z" />
        <path d="M 122 278 q 5 -3 9 1 q 2 4 -3 5 q -5 0 -7 -4 q -1 -1 1 -2 z" />
        <path d="M 378 278 q 5 -3 9 1 q 2 4 -3 5 q -5 0 -7 -4 q -1 -1 1 -2 z" />
        <path d="M 234 142 q 4 -4 7 0 q 2 3 -2 5 q -4 1 -6 -3 q -1 -1 1 -2 z" />
        <path d="M 266 142 q 4 -4 7 0 q 2 3 -2 5 q -4 1 -6 -3 q -1 -1 1 -2 z" />
        <path d="M 152 244 q 4 -3 7 0 q 2 3 -2 4 q -4 1 -6 -2 q -1 -1 1 -2 z" />
        <path d="M 348 244 q 4 -3 7 0 q 2 3 -2 4 q -4 1 -6 -2 q -1 -1 1 -2 z" />
      </g>

      {/* LAYER 5 — falling / drifting leaves (filled watercolor specks) */}
      <g>
        {/* left side — sage and teal mix */}
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(108 175) rotate(35)" color="#9CAB8B" opacity="0.78" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(85 240) rotate(-25)" color="#94A8AE" opacity="0.7" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(72 305) rotate(48)" color="#9CAB8B" opacity="0.75" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(58 365) rotate(15)" color="#DEB69B" opacity="0.62" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(135 130) rotate(20)" color="#9CAB8B" opacity="0.6" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(165 350) rotate(58)" color="#9CAB8B" opacity="0.65" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(140 395) rotate(10)" color="#94A8AE" opacity="0.55" />
        <use href="#qc-leaf" x="-5" y="-2.5" transform="translate(50 220) rotate(-30)" color="#9CAB8B" opacity="0.55" />
        <use href="#qc-leaf" x="-5" y="-2.5" transform="translate(195 305) rotate(40)" color="#9CAB8B" opacity="0.6" />

        {/* right side — peach and sage */}
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(380 165) rotate(-15)" color="#DEB69B" opacity="0.78" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(405 230) rotate(40)" color="#9CAB8B" opacity="0.7" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(425 295) rotate(-30)" color="#DEB69B" opacity="0.7" />
        <use href="#qc-leaf" x="-7" y="-3.5" transform="translate(440 360) rotate(20)" color="#9CAB8B" opacity="0.6" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(360 110) rotate(-25)" color="#DEB69B" opacity="0.6" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(330 355) rotate(-45)" color="#94A8AE" opacity="0.6" />
        <use href="#qc-leaf" x="-6" y="-3" transform="translate(360 395) rotate(-15)" color="#DEB69B" opacity="0.55" />
        <use href="#qc-leaf" x="-5" y="-2.5" transform="translate(450 220) rotate(35)" color="#DEB69B" opacity="0.55" />
        <use href="#qc-leaf" x="-5" y="-2.5" transform="translate(305 320) rotate(-30)" color="#9CAB8B" opacity="0.6" />

        {/* centre — small drifting */}
        <use href="#qc-leaf" x="-4" y="-2" transform="translate(248 350) rotate(20)" color="#9CAB8B" opacity="0.5" />
        <use href="#qc-leaf" x="-4" y="-2" transform="translate(225 380) rotate(-20)" color="#DEB69B" opacity="0.45" />
        <use href="#qc-leaf" x="-4" y="-2" transform="translate(275 380) rotate(35)" color="#94A8AE" opacity="0.45" />
        <use href="#qc-leaf" x="-4" y="-2" transform="translate(220 95) rotate(50)" color="#9CAB8B" opacity="0.5" />
        <use href="#qc-leaf" x="-4" y="-2" transform="translate(285 88) rotate(-30)" color="#DEB69B" opacity="0.5" />
      </g>

      {/* LAYER 6 — birds (soft V-curves with body hint) */}
      <g stroke="#4A4640" fill="none" strokeLinecap="round" opacity="0.78">
        <path strokeWidth="1.4" d="M 122 130 q 6 -6 13 0 q 7 6 14 0" />
        <path strokeWidth="1.3" d="M 200 80 q 5 -5 10 0 q 5 5 10 0" />
        <path strokeWidth="1.4" d="M 285 100 q 6 -6 13 0 q 7 6 13 0" />
        <path strokeWidth="1.3" d="M 365 138 q 5 -5 10 0 q 5 5 10 0" />
        <path strokeWidth="1.1" d="M 100 285 q 5 -4 10 0 q 5 4 10 0" opacity="0.7" />
        <path strokeWidth="1.1" d="M 392 268 q 5 -4 10 0 q 5 4 10 0" opacity="0.7" />
        <path strokeWidth="1" d="M 218 220 q 4 -3 8 0 q 4 3 8 0" opacity="0.55" />
      </g>

      {/* LAYER 7 — figure at base, shoulder-up, going off bottom */}
      <g>
        {/* hair back layer */}
        <path
          d="M 230 442 Q 224 425 232 415 Q 240 405 250 405 Q 260 405 268 415 Q 276 425 270 442 Q 268 458 264 472 L 236 472 Q 232 458 230 442 Z"
          fill="#A07A5C"
          opacity="0.88"
          filter="url(#qc-water-soft)"
        />

        {/* face */}
        <ellipse
          cx="250"
          cy="440"
          rx="13"
          ry="15"
          fill="#E8C9B0"
          opacity="0.95"
          filter="url(#qc-water-soft)"
        />

        {/* hair fringe */}
        <path
          d="M 237 432 Q 244 426 250 428 Q 256 426 263 432 Q 261 436 256 435 Q 250 433 244 435 Q 239 436 237 432 Z"
          fill="#A07A5C"
          opacity="0.92"
          filter="url(#qc-water-soft)"
        />

        {/* hair side strands */}
        <path d="M 234 440 q -2 8 0 18" stroke="#A07A5C" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d="M 266 440 q 2 8 0 18" stroke="#A07A5C" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.7" />

        {/* closed eyes */}
        <path d="M 242 442 q 2.5 1.6 5 0" stroke="#3F3631" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.85" />
        <path d="M 253 442 q 2.5 1.6 5 0" stroke="#3F3631" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.85" />

        {/* mouth — quiet line */}
        <path d="M 246 450 q 4 1.2 8 0" stroke="#8C5E4A" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.55" />

        {/* shoulders + shirt — sage wash, off bottom */}
        <path
          d="M 222 478 Q 224 466 250 463 Q 276 466 278 478 L 290 540 L 210 540 Z"
          fill="#9CAB8B"
          opacity="0.78"
          filter="url(#qc-water-soft)"
        />

        {/* shirt neckline detail */}
        <path d="M 240 470 q 10 4 20 0" stroke="#7C8E6E" strokeWidth="0.7" fill="none" opacity="0.55" />
      </g>

      {/* faint ground shadow */}
      <ellipse cx="250" cy="538" rx="55" ry="3" fill="#9CAB8B" opacity="0.18" />
    </svg>
  );
}

export default HeroIllustration;
