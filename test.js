const { map, filter, take } = require('rxjs/operators');
const { interval } = require('rxjs/observable/interval');

var intervalo1 = interval(1000).pipe(take(3))
intervalo1.subscribe(res1=>{
    console.log('res1',res1);
    var intervalo2 = interval(1000).pipe(take(3))
    intervalo2.subscribe(res2=>{
        console.log('res2',res2)
    })
})