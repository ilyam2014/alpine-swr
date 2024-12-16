# SWR data fetching library for Alpine.js


## Installation

1. Install the library
```bash
npm i alpine-swr
```
2. Register custom Alpine.js magic property

```js
import swr from "alpine-swr";

Alpine.magic('swr', swr)
```

## Usage
```blade
<div x-data="{todos: $swr('https://jsonplaceholder.typicode.com/todos')}">
    <p x-show="!todos.data">Loading...</p>
    <div x-show="todos.data">
        <template x-for="todo in todos.data" :key="todo.id">
            <p>Title: <span x-text="todo.title"></span></p>
        </template>
    </div>
</div>

```
