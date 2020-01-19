require('dotenv').config();
var db = require('./db/main');
var jwt = require('jsonwebtoken');
var mail=require('./db/mailer')
var express = require('express')
var app = express()
const { map, filter, take } = require('rxjs/operators');
const { interval } = require('rxjs/observable/interval');
const bodyParser = require('body-parser');
var numeral = require('numeral');
var sha256 = require('sha256')
var oxr = require('open-exchange-rates'),
	fx = require('money');
var rates = require('./db/currency_rates')
oxr.set({ app_id: process.env.OWR_APP_DATA})

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'))
app.use(bodyParser.urlencoded({ extended: false }));
const sec = process.env.AUTH_DATA;
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "OPTIONS,POST, GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.set('port', (process.env.PORT || 5000))
function getTimesTamp(){
  return Math.floor(Date.now() / 1000)
}
var schedule = require('node-schedule');

var j = schedule.scheduleJob('00 00 13 * * *', function(){
  console.log('Daily alert check started!');
  
  getFromAlertas().then(res=>{
    console.log('1',res);
    var arr = [];
    // for (let a = 0;a<res.length;a++){
      var intervalo1 = interval(5000).pipe(take(res.length));
      intervalo1.subscribe(r1=>{
          getCurrency(res[r1]['moeda']).then(answer=>{

            rates.getRate(res[r1]['moeda'], answer, 1).then(novovalor=>{
  
            var plustaxes = novovalor[0]['total']
       
            if(plustaxes<=res[r1]['valor']){
              var valorEfetivo=numeral(plustaxes).format('0,0.0000');
                mail.sendEmail(res[r1]['email'],'Alerta de Câmbio '+res[r1]['moeda']+' Ativado!', valorEfetivo)
            }else{
              console.log('value higher or not email')
            }
            
      
            })
          
          console.log(arr);
        })
      })
      
    // }
    

});
});
function getCurrency(which){
  return new Promise((resolve, reject)=>{
    oxr.latest(function(err) {
      if (err){
        console.log(err);
        reject(err);
      } 
      fx.rates = oxr.rates;
      fx.base = oxr.base;
        var a = fx(1).from(which).to('BRL'); // ~8.0424
        console.log(a);
        resolve(a);
    });
  })
  
}

function getFromAlertas(){
  return new Promise((resolve, reject)=>{
    const sql = 'SELECT moeda, valor, email FROM alertas;';
  

  
    db.query(sql, function (error, results, fields){
      //if error return false success
        if(error){
          // console.log(error);
            console.log(error);
            reject();

         
        }else{
  
          console.log('getfromalertas',results[0]);
          resolve(results)
          
    
        }
      })

  })
  
}

app.post('/precohoje', function(req, res) {
  // var mail = req.body.email;
  var valor = req.body.valor;
  var moeda = req.body.moeda;
  var iat = getTimesTamp();
  getCurrency(moeda).then(cambio=>{
    // console.log(moeda, cambio)
  rates.getRate(moeda, cambio, valor).then(resposta=>{
    var baseCambio=numeral(resposta[0]['cambio']).format('0,0.00');
    var valorCambio=numeral(resposta[0]['cambio']).format('0,0.00');
    var valorIof=numeral(resposta[0]['iof']).format('0,0.00');
    var valorTotal=numeral(resposta[0]['total']).format('0,0.00');
    var valorEfetivo=numeral(resposta[0]['efetivo']).format('0,0.0000');
      res.json({efetivo:valorEfetivo, basecambio: baseCambio, moeda: moeda, total: valorTotal, valor: valorCambio, iof:valorIof, success:true});
    })
    
  })
   
   
  

})
app.get('/alertas', function(req, res) {
  var mail = req.body.email;
  
    var valor = req.body.valor;
    var moeda = req.body.moeda;
    var iat = getTimesTamp();
    const sql = 'SELECT * FROM alertas';
    const values = [[mail, moeda, valor, iat]]
  
    db.query(sql, function (error, results, fields){
      console.log('res',results);
      if(error){
          console.log(error);
          reject();
  
      }else{
  
        console.log(results[0]);
        res.json(results)
        
  
      }
    
      })

  // }
  
})

app.post('/alerta', function(req, res) {
  var mail = req.body.email;
  var valor = req.body.valor;
  var moeda = req.body.moeda;
  var valorunitario = req.body.valorunitario;
  var iat = getTimesTamp();
  const sql = 'INSERT INTO alertas(`email`, `moeda`, `valor`, `quantidade`, `iat`) VALUES (?);';
  const values = [[mail, moeda, valorunitario, valor, iat]]

  db.query(sql, values, function (error, results, fields){
    //if error return false success
    console.log('res',results);
      if(error){
        console.log(error);
        // logErrors(error['code']);
        if(error['code']==='ER_DUP_ENTRY'){  
          return res.json({msg:'Email já cadastrou alerta. Apenas um email por alerta.', success: false, error: true});
        }else{
          return res.json({msg:'Houve um erro. Tente novamente mais tarde', success: false, error: true});
        }

      }else{
        
        console.log('dsadsa',results['affectedRows']);

        if(results['affectedRows']!==0){
    
            res.json({msg: 'Alerta criado com sucesso', error: false, success:true});
          }else{
            res.json({msg: 'Erro ao criar alerta', error: true, success:false});
          }
    
     
      }
  
    })
})

app.post('/login', function(req, res) {
  var mail = req.body.email;
  var senha = req.body.password;
  // var moeda = req.body.moeda;
  var iat = getTimesTamp();
  const sql = 'SELECT senha FROM usuario WHERE email=?';
  const values = [[mail]]

  db.query(sql, values, function (error, results, fields){

      if(error){
   
        if(error){  
          return res.json({msg:'Erro', success: false, error: true});
        }

      }else{

        var got = results[0]['senha']
        var decrypt= sha256(senha);
        if(got===decrypt){
          var tok = {mail};
          var token = jwt.sign(tok, sec);
          return res.json({
            success: true, email: mail, message: 'Seja bem vindo(a)!',
            token: token
          });
        }else{
          return res.json({success: false, username: null, message: 'unauthorized'});
          
        }       
    
          
     
      }
  
    })
})

app.listen(app.get('port'), function() {
  console.log("running on:" + app.get('port'))
})
