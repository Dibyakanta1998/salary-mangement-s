.PHONY: dev test reset

dev:
	docker compose up --build

test:
	true

reset:
	docker compose down -v
