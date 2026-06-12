.PHONY: build up test stop clean

build:
	docker compose build

up:
	docker compose up -d --wait

test:
	docker compose up --build -d --wait
	docker compose run --rm --profile test tests npx playwright test

stop:
	docker compose stop

clean:
	docker compose down -v --remove-orphans
