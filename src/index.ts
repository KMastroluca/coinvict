import { fromHono } from "chanfana";
import { Hono } from "hono";
// Start a Hono app
const app = new Hono<{ Bindings: Env }>();


app.get('/', (req, res) =>{
    console.log("Hi");
})

