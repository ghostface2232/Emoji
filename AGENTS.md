# Emoji Physics Demo

## 프로젝트 개요
이모지를 선택하면 수백 개의 이모지 입자가 물리 시뮬레이션과 함께
특정 모양을 형성하는 인터랙티브 웹 데모.

## 기술 스택
- Vite (vanilla JS, no framework)
- PixiJS v8 (WebGL 렌더링, Sprite 기반)
- Matter.js (2D 물리, 장면에 따라 활용도 조절)
- No TypeScript, no React

## 핵심 아키텍처 규칙
1. 이모지는 OffscreenCanvas에서 한 번 래스터화하여 PixiJS Texture로 캐시한다.
   매 프레임 fillText를 호출하지 않는다.
2. 물리(Matter.js)와 렌더링(PixiJS)은 분리한다.
   Matter.js는 Body의 position/angle만 관리하고,
   PixiJS는 그 값을 읽어 Sprite에 반영한다.
3. 모양 형성은 target position + spring force 패턴으로 구현한다.
4. 각 장면은 SceneModule 인터페이스를 따르는 독립 모듈이다.
   (create, enter, update, exit, pointerImpulse, resize, dispose)
5. 전역 상태는 SceneManager가 관리한다.
6. 장면에 따라 Matter.js를 전면 활용하기도, 최소한으로만 쓰기도 한다.

## 코딩 컨벤션
- ES Modules (import/export) 사용
- 클래스 기반 설계 (Renderer, PhysicsWorld, SceneManager)
- 함수명은 camelCase
- 매직 넘버는 상수로 추출 (파일 상단 const)
- 주석은 한국어로 작성

## 성능 목표
- 60fps at 300 particles on mid-range laptop
- 30fps at 300 particles on mobile