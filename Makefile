.PHONY: dev test reset

dev:
	docker compose up --build

test:
	docker compose up -d db
	docker compose run --rm --build api node --test --test-concurrency=1 dist/employee.test.js dist/figures.test.js dist/bands.test.js dist/changes.test.js

reset:
	docker compose down -v
