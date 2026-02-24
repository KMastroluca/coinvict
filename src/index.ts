export default {
    
    
    async fetch(req:Request, res:Response, ctx: any):Promise<Response> {
        
        console.log("Worker");
        
        
        return res.html("HI");
        
    }
    
        
    
    
    
    
    
    
}

