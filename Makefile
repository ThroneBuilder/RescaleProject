.PHONY: build up test stop clean

build:
	docker compose build

up:
	docker compose up -d --wait

test:
	docker compose up --build -d --wait
	docker compose --profile test build tests
	docker compose --profile test run --rm tests npx playwright test

stop:
	docker compose stop

clean:
	docker compose down -v --remove-orphans
